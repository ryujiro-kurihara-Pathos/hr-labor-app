import { Injectable, inject } from '@angular/core';

import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { InsurancePremiumCollectionTiming } from '../../company/models/company.model';
import { resolvePremiumLiabilityYearMonth, resolvePremiumStandardDeterminationYearMonth } from '../../company/utils/company-payroll-settings.util';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { isBonusConfirmed } from '../../bonus/utils/bonus-status.util';
import { isCareInsurancePremiumTargetMonth } from '../../social-insurance/utils/care-insurance-period.util';
import {
    isHealthInsurancePremiumTargetMonth,
    isPensionInsurancePremiumTargetMonth,
} from '../../social-insurance/utils/age-premium-period.util';
import { ManualInsurancePremiumRates } from '../models/manual-insurance-premium-rate.model';
import { SocialInsuranceJoinJudgmentContext } from '../../social-insurance/utils/social-insurance-join-status.util';
import { SalaryCondition } from '../models/salary-condition.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { StandardRemunerationDeterminationService } from './standard-remuneration-determination.service';
import { bonusesForStandardBonusPremium } from '../utils/effective-monthly-reward.util';
import { resolveBonusPremiumableStandardAmounts } from '../utils/bonus-standard-amount-cap.util';
import { resolveInsurancePremiumRates } from '../utils/insurance-premium-rate-resolution.util';
import { roundInsurancePremium } from '../utils/insurance-premium-rounding.util';
import { isPremiumBasisRewardConfirmed } from '../utils/reward-pay-month.util';
import { savedRewardsForPremiumCalculation } from '../utils/reward-status.util';
import { addMonthsToYearMonth } from '../utils/reward-target-month.util';
import { getQualificationDate, PayrollPaymentMonthOffset } from '../utils/standard-remuneration-determination.util';

export type CalculatedInsurancePremium = {
    standardMonthlyAmount: number | null;
    healthInsuranceEmployeePremium: number;
    healthInsuranceEmployerPremium: number;
    pensionInsuranceEmployeePremium: number;
    pensionInsuranceEmployerPremium: number;
    careInsuranceEmployeePremium: number;
    careInsuranceEmployerPremium: number;
    monthlyEmployeePremiumTotal: number;
    monthlyEmployerPremiumTotal: number;
    bonusHealthInsuranceEmployeePremium: number;
    bonusHealthInsuranceEmployerPremium: number;
    bonusPensionInsuranceEmployeePremium: number;
    bonusPensionInsuranceEmployerPremium: number;
    bonusCareInsuranceEmployeePremium: number;
    bonusCareInsuranceEmployerPremium: number;
    bonusEmployeePremiumTotal: number;
    bonusEmployerPremiumTotal: number;
    totalEmployeePremium: number;
    totalEmployerPremium: number;
};

export type InsurancePremiumCalculationParams = {
    employee: Employee;
    payYearMonth: string;
    collectionTiming: InsurancePremiumCollectionTiming;
    rewardsByYearMonth: Record<string, StandardMonthlyReward>;
    bonuses: BonusReward[];
    healthInsuranceStartDate: string | null;
    healthInsuranceEndDate: string | null;
    pensionInsuranceStartDate: string | null;
    pensionInsuranceEndDate: string | null;
    office: Office | null;
    manualRates?: ManualInsurancePremiumRates | null;
    payrollPaymentMonthOffset?: PayrollPaymentMonthOffset;
    salaryConditions?: SalaryCondition[];
    joinJudgmentContext?: SocialInsuranceJoinJudgmentContext | null;
};

@Injectable({
    providedIn: 'root',
})
export class InsurancePremiumCalculationService {
    private readonly determinationService = inject(StandardRemunerationDeterminationService);

    /** 根拠月の報酬確定後に紐づく給与控除月 */
    payYearMonthsForLiabilityMonth(
        liabilityYearMonth: string,
        collectionTiming: InsurancePremiumCollectionTiming,
    ): string[] {
        if (collectionTiming === 'next_month') {
            return [addMonthsToYearMonth(liabilityYearMonth, 1)];
        }
        return [liabilityYearMonth];
    }

    calculateForPayMonth(params: InsurancePremiumCalculationParams): CalculatedInsurancePremium | null {
        const {
            employee,
            payYearMonth,
            collectionTiming,
            rewardsByYearMonth,
            bonuses,
            healthInsuranceStartDate,
            healthInsuranceEndDate,
            pensionInsuranceStartDate,
            pensionInsuranceEndDate,
            office,
            manualRates = null,
            payrollPaymentMonthOffset = 1,
            salaryConditions = [],
            joinJudgmentContext = null,
        } = params;

        const liabilityYearMonth = resolvePremiumLiabilityYearMonth(payYearMonth, collectionTiming);
        if (!liabilityYearMonth) return null;

        if (!isPremiumBasisRewardConfirmed(
            rewardsByYearMonth,
            payYearMonth,
            collectionTiming,
            payrollPaymentMonthOffset,
        )) {
            return null;
        }

        const savedRewards = savedRewardsForPremiumCalculation(rewardsByYearMonth);
        const standardDeterminationYearMonth = resolvePremiumStandardDeterminationYearMonth(
            payYearMonth,
            collectionTiming,
        );
        const effective = this.determinationService.resolve(
            employee,
            savedRewards,
            standardDeterminationYearMonth,
            healthInsuranceStartDate,
            bonuses,
            payrollPaymentMonthOffset,
            salaryConditions,
            joinJudgmentContext,
        );
        if (!effective?.isComplete || !effective.calculation?.health) return null;

        const standardMonthlyAmount = effective.calculation.health.standardMonthlyAmount;
        const qualificationDate = getQualificationDate(employee, healthInsuranceStartDate);
        const rates = resolveInsurancePremiumRates({
            liabilityYearMonth,
            office,
            employee,
            manualRates,
        });

        const isHealthMonth = isHealthInsurancePremiumTargetMonth(
            liabilityYearMonth,
            qualificationDate,
            healthInsuranceEndDate,
            employee.birthDate,
        );
        const isPensionMonth = isPensionInsurancePremiumTargetMonth(
            liabilityYearMonth,
            qualificationDate,
            healthInsuranceEndDate,
            pensionInsuranceStartDate,
            pensionInsuranceEndDate,
            employee.birthDate,
        );
        const isCareMonth = isCareInsurancePremiumTargetMonth(
            liabilityYearMonth,
            qualificationDate,
            healthInsuranceEndDate,
            employee.birthDate,
        );

        const healthInsuranceEmployeePremium = isHealthMonth
            ? this.premium(standardMonthlyAmount, rates.healthEmployeeRate)
            : 0;
        const healthInsuranceEmployerPremium = isHealthMonth
            ? this.premium(standardMonthlyAmount, rates.healthEmployerRate)
            : 0;
        const pensionInsuranceEmployeePremium = isPensionMonth
            ? this.premium(standardMonthlyAmount, rates.pensionEmployeeRate)
            : 0;
        const pensionInsuranceEmployerPremium = isPensionMonth
            ? this.premium(standardMonthlyAmount, rates.pensionEmployerRate)
            : 0;
        const careInsuranceEmployeePremium = isCareMonth
            ? this.premium(standardMonthlyAmount, rates.careEmployeeRate)
            : 0;
        const careInsuranceEmployerPremium = isCareMonth
            ? this.premium(standardMonthlyAmount, rates.careEmployerRate)
            : 0;

        const monthlyEmployeePremiumTotal =
            healthInsuranceEmployeePremium + pensionInsuranceEmployeePremium + careInsuranceEmployeePremium;
        const monthlyEmployerPremiumTotal =
            healthInsuranceEmployerPremium + pensionInsuranceEmployerPremium + careInsuranceEmployerPremium;

        const bonusesInPayMonth = bonuses.filter((bonus) => bonus.targetYearMonth === payYearMonth);
        const bonusTargets = bonusesForStandardBonusPremium(
            bonusesInPayMonth,
            liabilityYearMonth,
            bonuses,
        );

        let bonusHealthInsuranceEmployeePremium = 0;
        let bonusHealthInsuranceEmployerPremium = 0;
        let bonusPensionInsuranceEmployeePremium = 0;
        let bonusPensionInsuranceEmployerPremium = 0;
        let bonusCareInsuranceEmployeePremium = 0;
        let bonusCareInsuranceEmployerPremium = 0;
        if (bonusTargets.length > 0) {
            const confirmedBonuses = bonuses.filter((item) => isBonusConfirmed(item));
            const premiumableAmounts = resolveBonusPremiumableStandardAmounts({
                liabilityYearMonth,
                monthBonuses: bonusTargets,
                allBonuses: confirmedBonuses,
            });

            bonusHealthInsuranceEmployeePremium = isHealthMonth
                ? this.premium(premiumableAmounts.healthAndCare, rates.healthEmployeeRate)
                : 0;
            bonusHealthInsuranceEmployerPremium = isHealthMonth
                ? this.premium(premiumableAmounts.healthAndCare, rates.healthEmployerRate)
                : 0;
            bonusPensionInsuranceEmployeePremium = isPensionMonth
                ? this.premium(premiumableAmounts.pension, rates.pensionEmployeeRate)
                : 0;
            bonusPensionInsuranceEmployerPremium = isPensionMonth
                ? this.premium(premiumableAmounts.pension, rates.pensionEmployerRate)
                : 0;
            bonusCareInsuranceEmployeePremium = isCareMonth
                ? this.premium(premiumableAmounts.healthAndCare, rates.careEmployeeRate)
                : 0;
            bonusCareInsuranceEmployerPremium = isCareMonth
                ? this.premium(premiumableAmounts.healthAndCare, rates.careEmployerRate)
                : 0;
        }

        const bonusEmployeePremiumTotal =
            bonusHealthInsuranceEmployeePremium
            + bonusPensionInsuranceEmployeePremium
            + bonusCareInsuranceEmployeePremium;
        const bonusEmployerPremiumTotal =
            bonusHealthInsuranceEmployerPremium
            + bonusPensionInsuranceEmployerPremium
            + bonusCareInsuranceEmployerPremium;

        return {
            standardMonthlyAmount,
            healthInsuranceEmployeePremium,
            healthInsuranceEmployerPremium,
            pensionInsuranceEmployeePremium,
            pensionInsuranceEmployerPremium,
            careInsuranceEmployeePremium,
            careInsuranceEmployerPremium,
            monthlyEmployeePremiumTotal,
            monthlyEmployerPremiumTotal,
            bonusHealthInsuranceEmployeePremium,
            bonusHealthInsuranceEmployerPremium,
            bonusPensionInsuranceEmployeePremium,
            bonusPensionInsuranceEmployerPremium,
            bonusCareInsuranceEmployeePremium,
            bonusCareInsuranceEmployerPremium,
            bonusEmployeePremiumTotal,
            bonusEmployerPremiumTotal,
            totalEmployeePremium: monthlyEmployeePremiumTotal + bonusEmployeePremiumTotal,
            totalEmployerPremium: monthlyEmployerPremiumTotal + bonusEmployerPremiumTotal,
        };
    }

    private premium(amount: number, rate: number | null): number {
        if (rate === null) return 0;
        return roundInsurancePremium(amount * rate);
    }
}
