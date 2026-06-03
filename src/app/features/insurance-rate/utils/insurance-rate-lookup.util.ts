import {
    HealthInsuranceProviderType,
    InsuranceRateRow,
} from '../models/insurance-rate.model';

export function findHealthInsuranceRate(input: {
    rates: InsuranceRateRow[];
    targetYearMonth: string;
    providerType: HealthInsuranceProviderType;
    prefecture: string | null;
}): InsuranceRateRow | null {
    return input.rates.find((rate) => {
        if (rate.rateType !== 'healthInsurance') {
            return false;
        }

        if (rate.providerType !== input.providerType) {
            return false;
        }

        if (input.providerType === 'kyokai') {
            if (rate.prefecture !== input.prefecture) {
                return false;
            }
        }

        if (input.targetYearMonth < rate.effectiveFrom) {
            return false;
        }

        if (rate.effectiveTo !== null && input.targetYearMonth > rate.effectiveTo) {
            return false;
        }

        return true;
    }) ?? null;
}