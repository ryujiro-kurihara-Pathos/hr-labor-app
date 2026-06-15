import { EmploymentType } from '../../employee/models/employee.models';
import { isPartTimeEmployment } from '../../social-insurance/utils/part-time-insurance-judgment.util';

/** パート・アルバイトはシフト制のため、入力した月額を支払基礎日数で日割りしない */
export function shouldProrateMonthlyRewardByPaymentBaseDays(
    employmentType: EmploymentType,
): boolean {
    return !isPartTimeEmployment(employmentType);
}

export function getDaysInMonth(yearMonth: string): number {
    const year = Number(yearMonth.slice(0, 4));
    const month = Number(yearMonth.slice(5, 7));
    return new Date(year, month, 0).getDate();
}

/** 在籍日数に応じた報酬月額（パートは入力額をそのまま返す） */
export function resolveMonthlyRewardWithEnrollmentProration(params: {
    employmentType: EmploymentType;
    monthlyReward: number;
    paymentBaseDays: number;
    daysInMonth: number;
}): number {
    if (params.monthlyReward <= 0) return 0;
    if (!shouldProrateMonthlyRewardByPaymentBaseDays(params.employmentType)) {
        return params.monthlyReward;
    }
    if (params.paymentBaseDays >= params.daysInMonth) {
        return params.monthlyReward;
    }
    return Math.round(params.monthlyReward * params.paymentBaseDays / params.daysInMonth);
}
