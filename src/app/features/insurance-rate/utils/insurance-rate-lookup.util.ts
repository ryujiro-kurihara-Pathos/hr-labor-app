import {
    HealthInsuranceProviderType,
    InsuranceRateRow,
} from '../models/insurance-rate.model';
import { KYOKAI_CARE_INSURANCE_RATES } from '../data/care-insurance-rates';

// 健康保険料率を検索
export function findHealthInsuranceRate(input: {
    rates: InsuranceRateRow[];
    targetYearMonth: string;
    providerType: HealthInsuranceProviderType;
    prefecture: string | null;
}): InsuranceRateRow | null {
    return input.rates.find((rate) => {
        // 料率タイプが健康保険でない場合は除外
        if (rate.rateType !== 'healthInsurance') {
            return false;
        }

        // 提供者が一致しない場合は除外
        if (rate.providerType !== input.providerType) {
            return false;
        }

        // 協会けんぽの場合は都道府県が一致しない場合は除外
        if (input.providerType === 'kyokai') {
            if (rate.prefecture !== input.prefecture) {
                return false;
            }
        }

        // 対象年月が適用開始月より前の場合は除外
        if (input.targetYearMonth < rate.effectiveFrom) {
            return false;
        }

        // 対象年月が適用終了日より後の場合は除外
        if (rate.effectiveTo !== null && input.targetYearMonth > rate.effectiveTo) {
            return false;
        }

        return true;
    }) ?? null;
}

// 介護保険料率を検索
export function findCareInsuranceRate(
    targetYearMonth: string,
): InsuranceRateRow | null {
    return KYOKAI_CARE_INSURANCE_RATES.find((rate) => {
        // 料率タイプが介護保険でない場合は除外
        if (rate.rateType !== 'careInsurance') {
            return false;
        }

        // 提供者が協会けんぽでない場合は除外
        if (rate.providerType !== 'kyokai') {
            return false;
        }

        // 対象年月が適用開始月より前の場合は除外
        if (targetYearMonth < rate.effectiveFrom) {
            return false;
        }

        // 対象年月が適用終了日より後の場合は除外
        if (rate.effectiveTo !== null && targetYearMonth > rate.effectiveTo) {
            return false;
        }

        return true;
    }) ?? null;
}