import { Injectable, inject } from '@angular/core';

import { Employee } from '../../employee/models/employee.models';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { pickWinningDeterminationCandidate } from '../utils/determination-precedence.util';
import { yearMonthFromDateString } from '../utils/reward-target-month.util';
import {
    formatYearMonthLabel,
    formatYearMonthList,
    getFirstRegularDeterminationYearMonth,
    getQualificationDate,
    getRegularCalculationMonths,
    getRegularDeterminationBaseYear,
} from '../utils/standard-remuneration-determination.util';
import {
    StandardMonthlyRewardCalculation,
    StandardMonthlyRewardCalculatorService,
} from './standard-monthly-reward-calculator.service';

@Injectable({
    providedIn: 'root',
})
export class StandardRemunerationDeterminationService {
    private readonly calculator = inject(StandardMonthlyRewardCalculatorService);

    // 標準報酬月額の決定
    resolve(
        employee: Employee,
        rewardsByYearMonth: Record<string, StandardMonthlyReward>,
        targetYearMonth: string,
        healthInsuranceStartDate?: string | null,
    ): EffectiveStandardRemuneration {
        // 資格取得日を取得
        const qualificationDate = getQualificationDate(employee, healthInsuranceStartDate);
        // 資格取得月を取得
        const qualificationYearMonth = qualificationDate
            ? yearMonthFromDateString(qualificationDate)
            : null;

        // 資格取得日または資格取得月が未登録の場合
        if (!qualificationDate || !qualificationYearMonth) {
            return this.incomplete(
                'initial',
                '資格取得時決定',
                '入社日または健康保険の資格取得日が未登録です。',
                null,
                [],
                [],
            );
        }

        // 定時決定の対象年月を取得
        const firstRegularYm = getFirstRegularDeterminationYearMonth(qualificationDate);
        const winner = pickWinningDeterminationCandidate(
            targetYearMonth,
            qualificationYearMonth,
            firstRegularYm,
            employee,
            qualificationDate,
            rewardsByYearMonth,
        );

        if (!winner) {
            if (targetYearMonth < firstRegularYm) {
                return this.resolveInitial(
                    qualificationYearMonth,
                    rewardsByYearMonth,
                    qualificationDate,
                );
            }
            return this.resolveRegularIncomplete(
                employee,
                qualificationDate,
                qualificationYearMonth,
                rewardsByYearMonth,
                targetYearMonth,
            );
        }

        switch (winner.kind) {
            case 'initial':
                return this.resolveInitial(
                    qualificationYearMonth,
                    rewardsByYearMonth,
                    qualificationDate,
                );
            case 'revision':
                return this.resolveRevision(
                    winner.revisionOriginMonth!,
                    qualificationYearMonth,
                    rewardsByYearMonth,
                );
            case 'regular':
                return this.resolveRegular(
                    employee,
                    qualificationDate,
                    qualificationYearMonth,
                    rewardsByYearMonth,
                    targetYearMonth,
                );
        }
    }

    // 資格取得時決定
    private resolveInitial(
        qualificationYearMonth: string,
        rewardsByYearMonth: Record<string, StandardMonthlyReward>,
        qualificationDate: string,
    ): EffectiveStandardRemuneration {
        const firstRegularYm = getFirstRegularDeterminationYearMonth(qualificationDate);
        const untilYm = this.addMonths(firstRegularYm, -1);
        const untilLabel = formatYearMonthLabel(untilYm);

        const initialReward = rewardsByYearMonth[qualificationYearMonth];
        if (!initialReward) {
            return this.incomplete(
                'initial',
                '資格取得時決定',
                `${formatYearMonthLabel(qualificationYearMonth)}の報酬情報（資格取得時）を登録してください。${untilLabel}までこの標準報酬月額が適用されます。`,
                qualificationYearMonth,
                [qualificationYearMonth],
                [qualificationYearMonth],
            );
        }

        return {
            determinationType: 'initial',
            determinationLabel: '資格取得時決定',
            description: `${formatYearMonthLabel(qualificationYearMonth)}の報酬に基づく標準報酬月額を適用（${untilLabel}まで）。`,
            qualificationYearMonth,
            calculationMonths: [qualificationYearMonth],
            averageMonthlyReward: this.monthlyReward(initialReward),
            calculation: this.calculationFromReward(initialReward),
            isComplete: true,
            missingMonths: [],
        };
    }

    // 随時決定（月額変更）
    private resolveRevision(
        revisionOriginMonth: string, // 変更月
        qualificationYearMonth: string, // 資格取得月
        rewardsByYearMonth: Record<string, StandardMonthlyReward>, // 報酬月額
    ): EffectiveStandardRemuneration {
        // 変更月の報酬を取得
        const revisionReward = rewardsByYearMonth[revisionOriginMonth];
        // 変更月の報酬が未登録の場合
        if (!revisionReward) {
            return this.incomplete(
                'revision',
                '随時決定（月額変更）',
                `${formatYearMonthLabel(revisionOriginMonth)}の報酬情報（固定的賃金の変更月）を登録してください。`,
                qualificationYearMonth,
                [revisionOriginMonth],
                [revisionOriginMonth],
            );
        }

        // 変更月の報酬から標準報酬月額の計算
        const calculation = this.calculator.calculate(this.monthlyReward(revisionReward));
        // 変更月の報酬から等級を判定できない場合
        if (!calculation.health || !calculation.pension) {
            return this.incomplete(
                'revision',
                '随時決定（月額変更）',
                `${formatYearMonthLabel(revisionOriginMonth)}の報酬月額から等級を判定できませんでした。`,
                qualificationYearMonth,
                [revisionOriginMonth],
                [],
            );
        }

        // 随時決定（月額変更）の結果を返す
        return {
            determinationType: 'revision',
            determinationLabel: '随時決定（月額変更）',
            description: `${formatYearMonthLabel(revisionOriginMonth)}に固定的賃金の変更があり、その報酬に基づく標準報酬月額を適用しています。`,
            qualificationYearMonth,
            calculationMonths: [revisionOriginMonth],
            averageMonthlyReward: this.monthlyReward(revisionReward),
            calculation,
            isComplete: true,
            missingMonths: [],
        };
    }

    // 定時決定
    private resolveRegular(
        employee: Employee,
        qualificationDate: string,
        qualificationYearMonth: string,
        rewardsByYearMonth: Record<string, StandardMonthlyReward>,
        targetYearMonth: string,
    ): EffectiveStandardRemuneration {
        const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
        const calculationMonths = getRegularCalculationMonths(employee, baseYear, qualificationDate);
        const applyFrom = `${baseYear}-09`;
        const applyUntil = `${baseYear + 1}-08`;

        if (calculationMonths.length === 0) {
            return this.incomplete(
                'regular',
                '定時決定',
                `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定対象ですが、${baseYear}年4〜6月に在籍月がありません。`,
                qualificationYearMonth,
                calculationMonths,
                [],
            );
        }

        const missingMonths = calculationMonths.filter((ym) => !rewardsByYearMonth[ym]);
        if (missingMonths.length > 0) {
            return this.incomplete(
                'regular',
                '定時決定',
                `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定。${formatYearMonthList(calculationMonths)}の報酬情報が必要です（未登録: ${formatYearMonthList(missingMonths)}）。`,
                qualificationYearMonth,
                calculationMonths,
                missingMonths,
            );
        }

        const total = calculationMonths.reduce(
            (sum, ym) => sum + this.monthlyReward(rewardsByYearMonth[ym]),
            0,
        );
        const averageMonthlyReward = Math.round(total / calculationMonths.length);
        const calculation = this.calculator.calculate(averageMonthlyReward);

        if (!calculation.health || !calculation.pension) {
            return this.incomplete(
                'regular',
                '定時決定',
                '定時決定の平均報酬月額から等級を判定できませんでした。',
                qualificationYearMonth,
                calculationMonths,
                [],
            );
        }

        return {
            determinationType: 'regular',
            determinationLabel: '定時決定',
            description: `${formatYearMonthList(calculationMonths)}の平均報酬月額 ${averageMonthlyReward.toLocaleString()} 円を適用（${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}）。`,
            qualificationYearMonth,
            calculationMonths,
            averageMonthlyReward,
            calculation,
            isComplete: true,
            missingMonths: [],
        };
    }

    /** 定時決定が候補に上がらない（算定月未入力）場合の案内 */
    private resolveRegularIncomplete(
        employee: Employee,
        qualificationDate: string,
        qualificationYearMonth: string,
        rewardsByYearMonth: Record<string, StandardMonthlyReward>,
        targetYearMonth: string,
    ): EffectiveStandardRemuneration {
        const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
        const calculationMonths = getRegularCalculationMonths(employee, baseYear, qualificationDate);
        const applyFrom = `${baseYear}-09`;
        const applyUntil = `${baseYear + 1}-08`;

        if (calculationMonths.length === 0) {
            return this.incomplete(
                'regular',
                '定時決定',
                `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定対象ですが、${baseYear}年4〜6月に在籍月がありません。`,
                qualificationYearMonth,
                calculationMonths,
                [],
            );
        }

        const missingMonths = calculationMonths.filter((ym) => !rewardsByYearMonth[ym]);
        return this.incomplete(
            'regular',
            '定時決定',
            `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定。${formatYearMonthList(calculationMonths)}の報酬情報が必要です（未登録: ${formatYearMonthList(missingMonths)}）。`,
            qualificationYearMonth,
            calculationMonths,
            missingMonths,
        );
    }

    // 報酬から標準報酬月額の計算
    private calculationFromReward(reward: StandardMonthlyReward): StandardMonthlyRewardCalculation {
        return {
            monthlyReward: this.monthlyReward(reward),
            health: {
                grade: reward.healthInsuranceGrade,
                standardMonthlyAmount: reward.healthInsuranceStandardMonthlyAmount,
            },
            pension: {
                grade: reward.pensionInsuranceGrade,
                standardMonthlyAmount: reward.pensionInsuranceStandardMonthlyAmount,
            },
        };
    }

    // 報酬から月額報酬の計算
    private monthlyReward(reward: StandardMonthlyReward): number {
        return (
            reward.basicSalary +
            reward.commutingAllowance +
            reward.monthlyAllowance +
            reward.positionAllowance +
            reward.housingAllowance +
            reward.fixedOvertimePay
        );
    }

    // 決定不能の場合
    private incomplete(
        determinationType: 'initial' | 'regular' | 'revision',
        determinationLabel: string,
        description: string,
        qualificationYearMonth: string | null,
        calculationMonths: string[],
        missingMonths: string[],
    ): EffectiveStandardRemuneration {
        return {
            determinationType,
            determinationLabel,
            description,
            qualificationYearMonth,
            calculationMonths,
            averageMonthlyReward: null,
            calculation: null,
            isComplete: false,
            missingMonths,
        };
    }

    // 月を加算
    private addMonths(ym: string, delta: number): string {
        const [y, m] = ym.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
}
