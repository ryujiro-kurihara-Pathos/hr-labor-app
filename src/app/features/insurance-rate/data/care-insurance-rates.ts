import { InsuranceRateRow } from '../models/insurance-rate.model';

export const KYOKAI_CARE_INSURANCE_RATES: InsuranceRateRow[] = [
    {
        rateType: 'careInsurance',
        providerType: 'kyokai',
        prefecture: null,

        effectiveFrom: '2024-03',
        effectiveTo: '2025-02',

        totalRate: 0.016,
        employeeRate: 0.008,
        employerRate: 0.008,
    },
    {
        rateType: 'careInsurance',
        providerType: 'kyokai',
        prefecture: null,

        effectiveFrom: '2025-03',
        effectiveTo: '2026-02',

        totalRate: 0.0159,
        employeeRate: 0.00795,
        employerRate: 0.00795,
    },
    {
        rateType: 'careInsurance',
        providerType: 'kyokai',
        prefecture: null,

        effectiveFrom: '2026-03',
        effectiveTo: null,

        totalRate: 0.0162,
        employeeRate: 0.0081,
        employerRate: 0.0081,
    },
];