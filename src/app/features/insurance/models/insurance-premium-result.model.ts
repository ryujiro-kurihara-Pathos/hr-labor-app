import { Timestamp } from 'firebase/firestore';

/** 従業員×対象年月ごとの保険料計算結果（保存用） */
export type InsurancePremiumResult = {
    id: string;
    companyId: string;
    employeeId: string;
    targetYearMonth: string;
    standardMonthlyAmount: number | null;
    healthInsuranceEmployeePremium: number;
    healthInsuranceEmployerPremium: number;
    pensionInsuranceEmployeePremium: number;
    pensionInsuranceEmployerPremium: number;
    careInsuranceEmployeePremium: number;
    careInsuranceEmployerPremium: number;
    monthlyEmployeePremiumTotal: number;
    monthlyEmployerPremiumTotal: number;
    bonusEmployeePremiumTotal: number;
    bonusEmployerPremiumTotal: number;
    totalEmployeePremium: number;
    totalEmployerPremium: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
};

export type InsurancePremiumResultInput = Omit<
    InsurancePremiumResult,
    'id' | 'createdAt' | 'updatedAt'
>;
