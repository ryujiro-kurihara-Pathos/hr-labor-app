export type InsuranceRateType =
    | 'healthInsurance'
    | 'careInsurance'
    | 'pensionInsurance';

export type HealthInsuranceProviderType =
    | 'kyokai'
    | 'union';

export type InsuranceRateRow = {
    rateType: InsuranceRateType;

    providerType: HealthInsuranceProviderType | null;

    prefecture: string | null;

    effectiveFrom: string;      // 例: '2026-03'
    effectiveTo: string | null; // 継続中なら null

    totalRate: number;          // 例: 9.91% → 0.0991
    employeeRate: number;       // 本人負担率
    employerRate: number;       // 会社負担率
};