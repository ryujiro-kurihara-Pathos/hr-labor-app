import { Injectable, inject } from '@angular/core';

import { Employee } from '../../employee/models/employee.models';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { yearMonthFromDateString } from '../utils/reward-target-month.util';
import {
    formatYearMonthLabel,
    formatYearMonthList,
    getDeterminationType,
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

    resolve(
        employee: Employee,
        rewardsByYearMonth: Record<string, StandardMonthlyReward>,
        targetYearMonth: string,
        healthInsuranceStartDate?: string | null,
    ): EffectiveStandardRemuneration {
        const qualificationDate = getQualificationDate(employee, healthInsuranceStartDate);
        const qualificationYearMonth = qualificationDate
            ? yearMonthFromDateString(qualificationDate)
            : null;

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

        if (getDeterminationType(qualificationDate, targetYearMonth) === 'initial') {
            return this.resolveInitial(
                qualificationYearMonth,
                rewardsByYearMonth,
                qualificationDate,
            );
        }

        return this.resolveRegular(
            employee,
            qualificationDate,
            qualificationYearMonth,
            rewardsByYearMonth,
            targetYearMonth,
        );
    }

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
                [],
                [qualificationYearMonth],
            );
        }

        return {
            determinationType: 'initial',
            determinationLabel: '資格取得時決定',
            description: `${formatYearMonthLabel(qualificationYearMonth)}の報酬に基づく標準報酬月額を適用（${untilLabel}まで）。`,
            qualificationYearMonth,
            calculationMonths: [qualificationYearMonth],
            averageMonthlyReward: initialReward.monthlyReward,
            calculation: this.calculationFromReward(initialReward),
            isComplete: true,
            missingMonths: [],
        };
    }

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
            (sum, ym) => sum + rewardsByYearMonth[ym].monthlyReward,
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

    private calculationFromReward(reward: StandardMonthlyReward): StandardMonthlyRewardCalculation {
        return {
            monthlyReward: reward.monthlyReward,
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

    private incomplete(
        determinationType: 'initial' | 'regular',
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

    private addMonths(ym: string, delta: number): string {
        const [y, m] = ym.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
}
