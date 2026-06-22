import { Injectable, inject } from '@angular/core';

import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { Employee } from '../../employee/models/employee.models';
import { SalaryCondition } from '../models/salary-condition.model';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { effectiveMonthlyRewardTotal } from '../utils/effective-monthly-reward.util';
import { pickWinningDeterminationCandidate } from '../utils/determination-precedence.util';
import { addMonthsToYearMonth, yearMonthFromDateString } from '../utils/reward-target-month.util';
import { formatPayMonthListFromWorkMonths, formatPayYearMonthLabelFromWorkMonth, lookupQualificationInitialReward, resolveQualificationRewardPayYearMonth } from '../utils/reward-pay-month.util';
import {
    formatYearMonthLabel,
    formatYearMonthList,
    getFirstRegularDeterminationYearMonth,
    getQualificationDate,
    getRegularBaseMonths,
    getRegularCalculationMonths,
    getRegularDeterminationBaseYear,
    getRegularDeterminationPaymentMonths,
    PayrollPaymentMonthOffset,
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
        payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
        salaryConditions: SalaryCondition[] = [],
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
            payrollPaymentMonthOffset,
            salaryConditions,
        );

        if (!winner) {
            if (targetYearMonth < firstRegularYm) {
                return this.resolveInitial(
                    qualificationYearMonth,
                    rewardsByYearMonth,
                    qualificationDate,
                    allBonuses,
                    payrollPaymentMonthOffset,
                );
            }
            return this.resolveRegularIncomplete(
                employee,
                qualificationDate,
                qualificationYearMonth,
                rewardsByYearMonth,
                targetYearMonth,
                payrollPaymentMonthOffset,
            );
        }

        switch (winner.kind) {
            case 'initial':
                return this.resolveInitial(
                    qualificationYearMonth,
                    rewardsByYearMonth,
                    qualificationDate,
                    allBonuses,
                    payrollPaymentMonthOffset,
                );
            case 'revision':
                return this.resolveRevision(
                    winner.revisionOriginMonth!,
                    qualificationYearMonth,
                    rewardsByYearMonth,
                    allBonuses,
                    payrollPaymentMonthOffset,
                );
            case 'regular':
                return this.resolveRegular(
                    employee,
                    qualificationDate,
                    qualificationYearMonth,
                    rewardsByYearMonth,
                    targetYearMonth,
                    allBonuses,
                    payrollPaymentMonthOffset,
                );
        }
    }

    // 資格取得時決定
    private resolveInitial(
        qualificationYearMonth: string,
        rewardsByYearMonth: Record<string, StandardMonthlyReward>,
        qualificationDate: string,
        allBonuses: BonusReward[],
        payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    ): EffectiveStandardRemuneration {
        const firstRegularYm = getFirstRegularDeterminationYearMonth(qualificationDate);
        const untilYm = this.addMonths(firstRegularYm, -1);
        const untilLabel = formatYearMonthLabel(untilYm);
        const rewardPayYearMonth = resolveQualificationRewardPayYearMonth(
            qualificationYearMonth,
            payrollPaymentMonthOffset,
        );

        const initialReward = lookupQualificationInitialReward(
            rewardsByYearMonth,
            qualificationYearMonth,
            payrollPaymentMonthOffset,
        );
        if (!initialReward) {
            const missingMessage = payrollPaymentMonthOffset === 1
                ? `${formatYearMonthLabel(rewardPayYearMonth)}支給分の報酬を確定してください（${formatYearMonthLabel(qualificationYearMonth)}入社・資格取得時）。${untilLabel}までこの標準報酬月額が適用されます。`
                : `${formatYearMonthLabel(qualificationYearMonth)}の報酬情報（資格取得時）を登録してください。${untilLabel}までこの標準報酬月額が適用されます。`;
            return this.incomplete(
                'initial',
                '資格取得時決定',
                missingMessage,
                qualificationYearMonth,
                [qualificationYearMonth],
                [qualificationYearMonth],
            );
        }

        const appliedLabel = payrollPaymentMonthOffset === 1
            ? `${formatYearMonthLabel(qualificationYearMonth)}分（${formatYearMonthLabel(rewardPayYearMonth)}支給）`
            : formatYearMonthLabel(qualificationYearMonth);

        return {
            determinationType: 'initial',
            determinationLabel: '資格取得時決定',
            description: `${appliedLabel}の報酬に基づく標準報酬月額を適用（${untilLabel}まで）。`,
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
        payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    ): EffectiveStandardRemuneration {
        const calculationMonths = [
            revisionOriginMonth,
            this.addMonths(revisionOriginMonth, 1),
            this.addMonths(revisionOriginMonth, 2),
        ];
        const calculationMonthsLabel = formatPayMonthListFromWorkMonths(
            calculationMonths,
            payrollPaymentMonthOffset,
        );

        const missingMonths = calculationMonths.filter((ym) => !rewardsByYearMonth[ym]);

        if (missingMonths.length > 0) {
            return this.incomplete(
                'revision',
                '随時決定（月額変更）',
                `${calculationMonthsLabel}の報酬情報が必要です（未登録: ${formatPayMonthListFromWorkMonths(missingMonths, payrollPaymentMonthOffset)}）。`,
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
        const applyFromLabel = formatPayYearMonthLabelFromWorkMonth(
            applyFrom,
            payrollPaymentMonthOffset,
        );

        return {
            determinationType: 'revision',
            determinationLabel: '随時決定（月額変更）',
            description: `${calculationMonthsLabel}の平均報酬月額 ${averageMonthlyReward.toLocaleString()} 円を適用（${applyFromLabel}から）。`,
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
        payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    ): EffectiveStandardRemuneration {
        const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
        const baseMonths = getRegularBaseMonths(
            employee,
            baseYear,
            qualificationDate,
            payrollPaymentMonthOffset,
        );
        const calculationMonths = getRegularCalculationMonths(
            employee,
            baseYear,
            qualificationDate,
            payrollPaymentMonthOffset,
        );
        const paymentMonthsLabel = formatYearMonthList(
            getRegularDeterminationPaymentMonths(baseYear),
        );
        const applyFrom = `${baseYear}-09`;
        const applyUntil = `${baseYear + 1}-08`;

        if (calculationMonths.length === 0) {
            return this.incomplete(
                'regular',
                '定時決定',
                `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定対象ですが、${paymentMonthsLabel}に支払われた給与のうち、支払基礎日数17日以上の月がありません。`,
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
                `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定。${paymentMonthsLabel}に支払われた給与（${formatYearMonthList(baseMonths)}分）の報酬情報が必要です（未登録: ${formatYearMonthList(missingMonths)}）。`,
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
            description: `${paymentMonthsLabel}に支払われた給与の平均報酬月額 ${averageMonthlyReward.toLocaleString()} 円を適用（${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}）。`,
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
        payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    ): EffectiveStandardRemuneration {
        const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
        const baseMonths = getRegularBaseMonths(
            employee,
            baseYear,
            qualificationDate,
            payrollPaymentMonthOffset,
        );
        const calculationMonths = getRegularCalculationMonths(
            employee,
            baseYear,
            qualificationDate,
            payrollPaymentMonthOffset,
        );
        const paymentMonthsLabel = formatYearMonthList(
            getRegularDeterminationPaymentMonths(baseYear),
        );
        const applyFrom = `${baseYear}-09`;
        const applyUntil = `${baseYear + 1}-08`;

        if (calculationMonths.length === 0) {
            return this.incomplete(
                'regular',
                '定時決定',
                `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定対象ですが、${paymentMonthsLabel}に支払われた給与のうち、支払基礎日数17日以上の月がありません。`,
                qualificationYearMonth,
                baseMonths,
                [],
            );
        }

        const missingMonths = baseMonths.filter((ym) => !rewardsByYearMonth[ym]);
        return this.incomplete(
            'regular',
            '定時決定',
            `${formatYearMonthLabel(applyFrom)}〜${formatYearMonthLabel(applyUntil)}の定時決定。${paymentMonthsLabel}に支払われた給与（${formatYearMonthList(baseMonths)}分）の報酬情報が必要です（未登録: ${formatYearMonthList(missingMonths)}）。`,
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
