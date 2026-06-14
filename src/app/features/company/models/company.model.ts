import { Timestamp } from 'firebase/firestore';

/** 保険料を給与から控除するタイミング（対象月の保険料をいつ控除するか） */
export type InsurancePremiumCollectionTiming = 'same_month' | 'next_month';

export const DEFAULT_COMPANY_PAYROLL_SETTINGS = {
    payrollClosingDay: null,
    payrollPaymentDay: null,
    payrollPaymentMonthOffset: 1 as const,
    insurancePremiumCollectionTiming: 'next_month' as InsurancePremiumCollectionTiming,
};

export type Company = {
    id: string;
    name: string;
    representativeName: string;
    address: string;
    createdBy: string;

    /** 給与締日（1-31、31=末日）。未設定可 */
    payrollClosingDay: number | null;
    /** 給与支払日（1-31、31=末日）。未設定可 */
    payrollPaymentDay: number | null;
    /** 支払日が当月か翌月か（0=当月、1=翌月） */
    payrollPaymentMonthOffset: 0 | 1;
    /** 社会保険料の給与控除タイミング */
    insurancePremiumCollectionTiming: InsurancePremiumCollectionTiming;

    createdAt: Timestamp;
    updatedAt: Timestamp;
};

export type CompanyInput = Omit<Company, 'id' | 'createdAt' | 'updatedAt'>;

export type CompanyUpdateInput = Pick<
    CompanyInput,
    | 'name'
    | 'representativeName'
    | 'address'
    | 'payrollClosingDay'
    | 'payrollPaymentDay'
    | 'payrollPaymentMonthOffset'
    | 'insurancePremiumCollectionTiming'
>;
