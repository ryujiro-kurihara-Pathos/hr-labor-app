import { Timestamp } from 'firebase/firestore';

export type BonusReward = {
    id: string;                         // 賞与ID

    // 会社・従業員紐づけ
    companyId: string;                  // 会社ID
    employeeId: string;                 // 従業員ID

    // 賞与情報
    paymentDate: string;                // 支給日 例: '2026-06-25'
    targetYearMonth: string;            // 支給年月 例: '2026-06'

    bonusAmount: number;                // 実際の賞与額
    standardBonusAmount: number;        // 標準賞与額 1000円未満切り捨て

    // 健康保険
    employeeHealthInsurancePremium: number;
    employerHealthInsurancePremium: number;
    totalHealthInsurancePremium: number;

    // 介護保険
    employeeCareInsurancePremium: number;
    employerCareInsurancePremium: number;
    totalCareInsurancePremium: number;

    // 厚生年金
    employeePensionInsurancePremium: number;
    employerPensionInsurancePremium: number;
    totalPensionInsurancePremium: number;

    // 合計
    employeeTotalPremium: number;
    employerTotalPremium: number;
    totalPremium: number;

    createdAt: Timestamp;
    updatedAt: Timestamp;
};

export type BonusRewardInput = {
    companyId: string;
    employeeId: string;

    paymentDate: string;
    targetYearMonth: string;

    bonusAmount: number;
};

export type BonusRewardForm = {
    employeeId: string;
    paymentDate: string;
    bonusAmount: number | '';
};