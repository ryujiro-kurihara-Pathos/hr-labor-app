import { Timestamp } from 'firebase/firestore';

/** 根拠月ごとの手動保険料率（自動料率データがない場合に使用） */
export type ManualInsurancePremiumRates = {
    id: string;
    companyId: string;
    employeeId: string;
    /** 保険料算定の根拠月（YYYY-MM） */
    liabilityYearMonth: string;
    /** 健康保険・本人負担料率（小数。例: 0.05105） */
    healthEmployeeRate: number | null;
    /** 健康保険・会社負担料率 */
    healthEmployerRate: number | null;
    /** 介護保険・本人負担料率 */
    careEmployeeRate: number | null;
    /** 介護保険・会社負担料率 */
    careEmployerRate: number | null;
    /** 厚生年金・本人負担料率 */
    pensionEmployeeRate: number | null;
    /** 厚生年金・会社負担料率 */
    pensionEmployerRate: number | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
};

export type ManualInsurancePremiumRatesInput = Omit<
    ManualInsurancePremiumRates,
    'id' | 'createdAt' | 'updatedAt'
>;

export type ManualInsurancePremiumRateForm = {
    healthRatePercent: number | '';
    careRatePercent: number | '';
    pensionRatePercent: number | '';
};

export const EMPTY_MANUAL_INSURANCE_PREMIUM_RATE_FORM: ManualInsurancePremiumRateForm = {
    healthRatePercent: '',
    careRatePercent: '',
    pensionRatePercent: '',
};
