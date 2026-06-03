import { InsuranceRateRow } from '../models/insurance-rate.model';
import { KYOKAI_HEALTH_INSURANCE_RATES_2026_03 } from './kyokai-health-insurance-rates-2026-03';

export const INSURANCE_RATES: InsuranceRateRow[] = [
    ...KYOKAI_HEALTH_INSURANCE_RATES_2026_03,
];