import { InsuranceRateRow } from '../models/insurance-rate.model';
import { KYOKAI_HEALTH_INSURANCE_RATES_2026_03 } from './kyokai-health-insurance-rates-2026-03';
import { KYOKAI_HEALTH_INSURANCE_RATES_2025_03 } from './kyokai-health-insurance-rates-2025-03';
import { KYOKAI_HEALTH_INSURANCE_RATES_2024_03 } from './kyokai-health-insurance-rates-2024-03';

export type KyokaiHealthInsuranceRateFile = {
    fileName: string;
    rates: InsuranceRateRow[];
}

export const KYOKAI_HEALTH_INSURANCE_RATE_FILES: KyokaiHealthInsuranceRateFile[] = [
    {
        fileName: 'kyokai-health-insurance-rates-2026-03.ts',
        rates: KYOKAI_HEALTH_INSURANCE_RATES_2026_03,
    },
    {
        fileName: 'kyokai-health-insurance-rates-2025-03.ts',
        rates: KYOKAI_HEALTH_INSURANCE_RATES_2025_03,
    },
    {
        fileName: 'kyokai-health-insurance-rates-2024-03.ts',
        rates: KYOKAI_HEALTH_INSURANCE_RATES_2024_03,
    },
]