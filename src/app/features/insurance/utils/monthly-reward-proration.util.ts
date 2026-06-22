import { EmploymentType } from '../../employee/models/employee.models';
import { isPartTimeEmployment } from '../../social-insurance/utils/part-time-insurance-judgment.util';
import {
    PayrollPaymentMonthOffset,
    resolveWorkMonthForPaymentBaseDays,
} from './standard-remuneration-determination.util';

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

/** 支給月に対応する勤務月の日数（翌月払いは前月の日数） */
export function resolveDaysInMonthForPayMonth(
    payYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): number {
    return getDaysInMonth(
        resolveWorkMonthForPaymentBaseDays(payYearMonth, payrollPaymentMonthOffset),
    );
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
