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
import { calculateInsurancePremiumShares } from '../utils/insurance-premium-rounding.util';
import { resolveMonthlyPremiumStandardAmounts } from '../utils/insurance-premium-standard-amount.util';
import { isPremiumBasisRewardConfirmed } from '../utils/reward-pay-month.util';
import { savedRewardsForPremiumCalculation } from '../utils/reward-status.util';
import { addMonthsToYearMonth } from '../utils/reward-target-month.util';
import { getQualificationDate, PayrollPaymentMonthOffset } from '../utils/standard-remuneration-determination.util';

export type CalculatedInsurancePremium = {
    /** 健康保険・介護保険の算定基礎（協会けんぽ表） */
    standardMonthlyAmount: number | null;
    /** 厚生年金の算定基礎（年金表・上限650,000円） */
    pensionStandardMonthlyAmount: number | null;
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

        const standardAmounts = resolveMonthlyPremiumStandardAmounts(effective.calculation);
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

        const healthShares = isHealthMonth && rates.healthTotalRate !== null && standardAmounts.health !== null
            ? calculateInsurancePremiumShares(standardAmounts.health, rates.healthTotalRate)
            : null;
        const pensionShares = isPensionMonth && rates.pensionTotalRate !== null && standardAmounts.pension !== null
            ? calculateInsurancePremiumShares(standardAmounts.pension, rates.pensionTotalRate)
            : null;
        const careShares = isCareMonth && rates.careTotalRate !== null && standardAmounts.care !== null
            ? calculateInsurancePremiumShares(standardAmounts.care, rates.careTotalRate)
            : null;

        const healthInsuranceEmployeePremium = healthShares?.employeePremium ?? 0;
        const healthInsuranceEmployerPremium = healthShares?.employerPremium ?? 0;
        const pensionInsuranceEmployeePremium = pensionShares?.employeePremium ?? 0;
        const pensionInsuranceEmployerPremium = pensionShares?.employerPremium ?? 0;
        const careInsuranceEmployeePremium = careShares?.employeePremium ?? 0;
        const careInsuranceEmployerPremium = careShares?.employerPremium ?? 0;

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

            const bonusHealthShares = isHealthMonth && rates.healthTotalRate !== null
                ? calculateInsurancePremiumShares(premiumableAmounts.healthAndCare, rates.healthTotalRate)
                : null;
            const bonusPensionShares = isPensionMonth && rates.pensionTotalRate !== null
                ? calculateInsurancePremiumShares(premiumableAmounts.pension, rates.pensionTotalRate)
                : null;
            const bonusCareShares = isCareMonth && rates.careTotalRate !== null
                ? calculateInsurancePremiumShares(premiumableAmounts.healthAndCare, rates.careTotalRate)
                : null;

            bonusHealthInsuranceEmployeePremium = bonusHealthShares?.employeePremium ?? 0;
            bonusHealthInsuranceEmployerPremium = bonusHealthShares?.employerPremium ?? 0;
            bonusPensionInsuranceEmployeePremium = bonusPensionShares?.employeePremium ?? 0;
            bonusPensionInsuranceEmployerPremium = bonusPensionShares?.employerPremium ?? 0;
            bonusCareInsuranceEmployeePremium = bonusCareShares?.employeePremium ?? 0;
            bonusCareInsuranceEmployerPremium = bonusCareShares?.employerPremium ?? 0;
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
            standardMonthlyAmount: standardAmounts.health,
            pensionStandardMonthlyAmount: standardAmounts.pension,
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
}
