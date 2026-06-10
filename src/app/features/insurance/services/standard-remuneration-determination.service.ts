import { Injectable, inject } from '@angular/core';

import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { Employee } from '../../employee/models/employee.models';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { effectiveMonthlyRewardTotal } from '../utils/effective-monthly-reward.util';
import { pickWinningDeterminationCandidate } from '../utils/determination-precedence.util';
import { addMonthsToYearMonth, yearMonthFromDateString } from '../utils/reward-target-month.util';
import {
    formatYearMonthLabel,
    formatYearMonthList,
    getFirstRegularDeterminationYearMonth,
    getQualificationDate,
    getRegularBaseMonths,
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
        allBonuses: BonusReward[] = [],
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
            (monthlyReward) => this.calculator.calculate(monthlyReward),
            allBonuses,
        );

        if (!winner) {
            if (targetYearMonth < firstRegularYm) {
                return this.resolveInitial(
                    qualificationYearMonth,
                    rewardsByYearMonth,
                    qualificationDate,
                    allBonuses,
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
                    allBonuses,
                );
            case 'revision':
                return this.resolveRevision(
                    winner.revisionOriginMonth!,
                    qualificationYearMonth,
                    rewardsByYearMonth,
                    allBonuses,
                );
            case 'regular':
                return this.resolveRegular(
                    employee,
                    qualificationDate,
                    qualificationYearMonth,
                    rewardsByYearMonth,
                    targetYearMonth,
                    allBonuses,
                );
        }
    }

    // 資格取得時決定
    private resolveInitial(
        qualificationYearMonth: string,
        rewardsByYearMonth: Record<string, StandardMonthlyReward>,
        qualificationDate: string,
        allBonuses: BonusReward[],
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
            averageMonthlyReward: this.monthlyReward(
                initialReward,
                qualificationYearMonth,
                allBonuses,
            ),
            calculation: this.calculationFromReward(
                initialReward,
                qualificationYearMonth,
                allBonuses,
            ),
            isComplete: true,
            missingMonths: [],
        };
    }

    // 随時決定（月額変更）
    private resolveRevision(
        revisionOriginMonth: string,
        qualificationYearMonth: string,
        rewardsByYearMonth: Record<string, StandardMonthlyReward>,
        allBonuses: BonusReward[],
    ): EffectiveStandardRemuneration {
        const calculationMonths = [
            revisionOriginMonth,
            this.addMonths(revisionOriginMonth, 1),
            this.addMonths(revisionOriginMonth, 2),
        ];

        const missingMonths = calculationMonths.filter((ym) => !rewardsByYearMonth[ym]);

        if (missingMonths.length > 0) {
            return this.incomplete(
                'revision',
                '随時決定（月額変更）',
                `${formatYearMonthList(calculationMonths)}の報酬情報が必要です（未登録: ${formatYearMonthList(missingMonths)}）。`,
                qualificationYearMonth,
                calculationMonths,
                missingMonths,
            );
        }

        const total = calculationMonths.reduce(
            (sum, ym) =>
                sum + this.monthlyReward(rewardsByYearMonth[ym], ym, allBonuses),
            0,
        );

        const averageMonthlyReward = Math.round(total / calculationMonths.length);
        const calculation = this.calculator.calculate(averageMonthlyReward);

        if (!calculation.health || !calculation.pension) {
            return this.incomplete(
                'revision',
                '随時決定（月額変更）',
                '随時改定の平均報酬月額から等級を判定できませんでした。',
                qualificationYearMonth,
                calculationMonths,
                [],
            );
        }

        const applyFrom = this.addMonths(revisionOriginMonth, 3);

        return {
            determinationType: 'revision',
            determinationLabel: '随時決定（月額変更）',
            description: `${formatYearMonthList(calculationMonths)}の平均報酬月額 ${averageMonthlyReward.toLocaleString()} 円を適用（${formatYearMonthLabel(applyFrom)}から）。`,
            qualificationYearMonth,
            calculationMonths,
            averageMonthlyReward,
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
        allBonuses: BonusReward[],
    ): EffectiveStandardRemuneration {
        const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
        const baseMonths = getRegularBaseMonths(employee, baseYear, qualificationDate);
        const calculationMonths = getRegularCalculationMonths(employee, baseYear, qualificationDate);
        const applyFrom = `${baseYear}-09`;
        const applyUntil = `${baseYear + 1}-08`;

        if (calculationMonths.length === 0) {
            return this.incomplete(
                'regular',
                '定時決定',
                `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定対象ですが、${baseYear}年4〜6月に支払基礎日数17日以上の月がありません。`,
                qualificationYearMonth,
                baseMonths,
                [],
            );
        }

        const missingMonths = baseMonths.filter((ym) => !rewardsByYearMonth[ym]);
        if (missingMonths.length > 0) {
            return this.incomplete(
                'regular',
                '定時決定',
                `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定。${formatYearMonthList(baseMonths)}の報酬情報が必要です（未登録: ${formatYearMonthList(missingMonths)}）。`,
                qualificationYearMonth,
                baseMonths,
                missingMonths,
            );
        }

        const total = calculationMonths.reduce(
            (sum, ym) =>
                sum + this.monthlyReward(rewardsByYearMonth[ym], ym, allBonuses),
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
        const baseMonths = getRegularBaseMonths(employee, baseYear, qualificationDate);
        const calculationMonths = getRegularCalculationMonths(employee, baseYear, qualificationDate);
        const applyFrom = `${baseYear}-09`;
        const applyUntil = `${baseYear + 1}-08`;

        if (calculationMonths.length === 0) {
            return this.incomplete(
                'regular',
                '定時決定',
                `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定対象ですが、${baseYear}年4〜6月に支払基礎日数17日以上の月がありません。`,
                qualificationYearMonth,
                baseMonths,
                [],
            );
        }

        const missingMonths = baseMonths.filter((ym) => !rewardsByYearMonth[ym]);
        return this.incomplete(
            'regular',
            '定時決定',
            `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定。${formatYearMonthList(baseMonths)}の報酬情報が必要です（未登録: ${formatYearMonthList(missingMonths)}）。`,
            qualificationYearMonth,
            baseMonths,
            missingMonths,
        );
    }

    // 報酬から標準報酬月額の計算
    private calculationFromReward(
        reward: StandardMonthlyReward,
        yearMonth: string,
        allBonuses: BonusReward[],
    ): StandardMonthlyRewardCalculation {
        const monthlyReward = this.monthlyReward(reward, yearMonth, allBonuses);
        const calculated = this.calculator.calculate(monthlyReward);
        return {
            monthlyReward,
            health: calculated.health ?? {
                grade: reward.healthInsuranceGrade,
                standardMonthlyAmount: reward.healthInsuranceStandardMonthlyAmount,
            },
            pension: calculated.pension ?? {
                grade: reward.pensionInsuranceGrade,
                standardMonthlyAmount: reward.pensionInsuranceStandardMonthlyAmount,
            },
        };
    }

    // 報酬から月額報酬の計算（年4回以上の賞与を含む）
    private monthlyReward(
        reward: StandardMonthlyReward,
        yearMonth: string,
        allBonuses: BonusReward[],
    ): number {
        return effectiveMonthlyRewardTotal(reward, yearMonth, allBonuses);
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
