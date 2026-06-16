import { Injectable, inject } from '@angular/core';

import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { InsurancePremiumCollectionTiming } from '../../company/models/company.model';
import { resolvePremiumLiabilityYearMonth } from '../../company/utils/company-payroll-settings.util';
import { resolveOfficePrefecture } from '../../company/utils/office-prefecture.util';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { isBonusConfirmed } from '../../bonus/utils/bonus-status.util';
import { KYOKAI_HEALTH_INSURANCE_RATE_FILES } from '../../insurance-rate/data/insurance-rates';
import { findCareInsuranceRate, findHealthInsuranceRate } from '../../insurance-rate/utils/insurance-rate-lookup.util';
import { isCareInsurancePremiumTargetMonth } from '../../social-insurance/utils/care-insurance-period.util';
import {
    isHealthInsurancePremiumTargetMonth,
    isPensionInsurancePremiumTargetMonth,
} from '../../social-insurance/utils/age-premium-period.util';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { StandardRemunerationDeterminationService } from './standard-remuneration-determination.service';
import { bonusesForStandardBonusPremium } from '../utils/effective-monthly-reward.util';
import { resolveBonusPremiumableStandardAmounts } from '../utils/bonus-standard-amount-cap.util';
import { roundInsurancePremium } from '../utils/insurance-premium-rounding.util';
import { isRewardConfirmed, savedRewardsForPremiumCalculation } from '../utils/reward-status.util';
import { addMonthsToYearMonth } from '../utils/reward-target-month.util';
import { getQualificationDate } from '../utils/standard-remuneration-determination.util';

const PENSION_RATE = 0.0915;

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
        } = params;

        const liabilityYearMonth = resolvePremiumLiabilityYearMonth(payYearMonth, collectionTiming);
        if (!liabilityYearMonth) return null;

        const liabilityReward = rewardsByYearMonth[liabilityYearMonth];
        if (!isRewardConfirmed(liabilityReward)) return null;

        const savedRewards = savedRewardsForPremiumCalculation(rewardsByYearMonth);
        const effective = this.determinationService.resolve(
            employee,
            savedRewards,
            liabilityYearMonth,
            healthInsuranceStartDate,
            bonuses,
        );
        if (!effective?.isComplete || !effective.calculation?.health) return null;

        const standardMonthlyAmount = effective.calculation.health.standardMonthlyAmount;
        const qualificationDate = getQualificationDate(employee, healthInsuranceStartDate);
        const healthRateRow = this.findHealthRateRow(liabilityYearMonth, office, employee);
        const careRateRow = findCareInsuranceRate(liabilityYearMonth);

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
            ? this.premium(standardMonthlyAmount, healthRateRow?.employeeRate ?? null)
            : 0;
        const healthInsuranceEmployerPremium = isHealthMonth
            ? this.premium(standardMonthlyAmount, healthRateRow?.employerRate ?? null)
            : 0;
        const pensionInsuranceEmployeePremium = isPensionMonth
            ? this.premium(standardMonthlyAmount, PENSION_RATE)
            : 0;
        const pensionInsuranceEmployerPremium = isPensionMonth
            ? this.premium(standardMonthlyAmount, PENSION_RATE)
            : 0;
        const careInsuranceEmployeePremium = isCareMonth
            ? this.premium(standardMonthlyAmount, careRateRow?.employeeRate ?? null)
            : 0;
        const careInsuranceEmployerPremium = isCareMonth
            ? this.premium(standardMonthlyAmount, careRateRow?.employerRate ?? null)
            : 0;

        const monthlyEmployeePremiumTotal =
            healthInsuranceEmployeePremium + pensionInsuranceEmployeePremium + careInsuranceEmployeePremium;
        const monthlyEmployerPremiumTotal =
            healthInsuranceEmployerPremium + pensionInsuranceEmployerPremium + careInsuranceEmployerPremium;

        const bonusesInLiabilityMonth = bonuses.filter((bonus) => bonus.targetYearMonth === liabilityYearMonth);
        const bonusTargets = bonusesForStandardBonusPremium(
            bonusesInLiabilityMonth,
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
                ? this.premium(premiumableAmounts.healthAndCare, healthRateRow?.employeeRate ?? null)
                : 0;
            bonusHealthInsuranceEmployerPremium = isHealthMonth
                ? this.premium(premiumableAmounts.healthAndCare, healthRateRow?.employerRate ?? null)
                : 0;
            bonusPensionInsuranceEmployeePremium = isPensionMonth
                ? this.premium(premiumableAmounts.pension, PENSION_RATE)
                : 0;
            bonusPensionInsuranceEmployerPremium = isPensionMonth
                ? this.premium(premiumableAmounts.pension, PENSION_RATE)
                : 0;
            bonusCareInsuranceEmployeePremium = isCareMonth
                ? this.premium(premiumableAmounts.healthAndCare, careRateRow?.employeeRate ?? null)
                : 0;
            bonusCareInsuranceEmployerPremium = isCareMonth
                ? this.premium(premiumableAmounts.healthAndCare, careRateRow?.employerRate ?? null)
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

    private findHealthRateRow(
        liabilityYearMonth: string,
        office: Office | null,
        employee: Employee,
    ) {
        const fiscalYear = this.healthInsuranceFiscalYear(liabilityYearMonth);
        const fileName = `kyokai-health-insurance-rates-${fiscalYear}-03.ts`;
        const rates =
            KYOKAI_HEALTH_INSURANCE_RATE_FILES.find((file) => file.fileName === fileName)?.rates ?? [];

        return findHealthInsuranceRate({
            rates,
            targetYearMonth: liabilityYearMonth,
            providerType: office?.healthInsuranceType ?? 'kyokai',
            prefecture: resolveOfficePrefecture(office, employee.prefecture),
        });
    }

    private healthInsuranceFiscalYear(targetYearMonth: string): string {
        const [y, m] = targetYearMonth.split('-').map(Number);
        return m < 3 ? String(y - 1) : String(y);
    }
}
