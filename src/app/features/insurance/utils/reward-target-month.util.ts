import { Timestamp } from 'firebase/firestore';

import { Employee } from '../../employee/models/employee.models';
import {
    resolveInsuredPeriodBounds,
    validateDateWithinInsuredPeriod,
} from '../../social-insurance/utils/procedure-date-range.util';

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function yearMonthFromDateString(date: string | null | undefined): string | null {
    if (!date || date.length < 7) return null;
    const ym = date.slice(0, 7);
    return YEAR_MONTH_PATTERN.test(ym) ? ym : null;
}

export function yearMonthFromTimestamp(ts: Timestamp | null | undefined): string | null {
    if (!ts) return null;
    const d = ts.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

export function dateStringFromTimestamp(ts: Timestamp | null | undefined): string | null {
    if (!ts) return null;
    const d = ts.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** 日付が入社日以降かつ退職日以前（在籍中は退職日チェックなし） */
export function isDateWithinEmploymentPeriod(employee: Employee, date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

    const joinedDate = employee.joinedDate?.trim();
    if (joinedDate && date < joinedDate) return false;

    const retiredDate = dateStringFromTimestamp(employee.retiredDate);
    if (retiredDate && date > retiredDate) return false;

    return true;
}

export function employmentPeriodDateReason(employee: Employee, date: string): string | null {
    if (isDateWithinEmploymentPeriod(employee, date)) return null;

    const joinedDate = employee.joinedDate?.trim();
    if (joinedDate && date < joinedDate) {
        return `${formatDateLabel(joinedDate)}入社のため、この日付は対象外です。`;
    }

    const retiredDate = dateStringFromTimestamp(employee.retiredDate);
    if (retiredDate && date > retiredDate) {
        return `${formatDateLabel(retiredDate)}退職のため、この日付は対象外です。`;
    }

    return '在籍期間外の日付です。';
}

/** 賞与支給日が入力可能な期間か（対象年月＋被保険者の資格期間） */
export function isBonusPaymentDateAllowed(
    employee: Employee,
    paymentDate: string,
    insuranceDates?: {
        healthInsuranceStartDate?: string | null;
        healthInsuranceEndDate?: string | null;
    },
): boolean {
    const targetYearMonth = yearMonthFromDateString(paymentDate);
    if (!targetYearMonth || !isRewardTargetMonth(employee, targetYearMonth)) return false;

    const bounds = resolveInsuredPeriodBounds({
        employee,
        healthInsuranceStartDate: insuranceDates?.healthInsuranceStartDate,
        healthInsuranceEndDate: insuranceDates?.healthInsuranceEndDate,
    });
    return validateDateWithinInsuredPeriod(paymentDate, bounds) === null;
}

export function bonusPaymentDateReason(
    employee: Employee,
    paymentDate: string,
    insuranceDates?: {
        healthInsuranceStartDate?: string | null;
        healthInsuranceEndDate?: string | null;
    },
): string | null {
    const targetYearMonth = yearMonthFromDateString(paymentDate);
    if (!targetYearMonth) return '支給日の形式が正しくありません。';

    const monthReason = rewardTargetMonthReason(employee, targetYearMonth);
    if (monthReason) return monthReason;

    const bounds = resolveInsuredPeriodBounds({
        employee,
        healthInsuranceStartDate: insuranceDates?.healthInsuranceStartDate,
        healthInsuranceEndDate: insuranceDates?.healthInsuranceEndDate,
    });
    return validateDateWithinInsuredPeriod(paymentDate, bounds);
}

/** 在籍中は当月、退職済みは退職月まで閲覧可能 */
export function viewableYearMonthMax(employee: Employee, currentYearMonth: string): string {
    const retireYm = yearMonthFromTimestamp(employee.retiredDate);
    if (retireYm) return retireYm;
    return currentYearMonth;
}

/** 矢印ナビの上限（退職月のみ。在籍中は上限なし） */
export function navigableYearMonthMax(employee: Employee): string | null {
    return yearMonthFromTimestamp(employee.retiredDate);
}

export function viewableYearMonthMin(employee: Employee): string | null {
    return yearMonthFromDateString(employee.joinedDate);
}

/** 入社月〜退職月（在籍中は当月）の範囲内か */
export function isViewableYearMonth(
    employee: Employee,
    targetYearMonth: string,
    currentYearMonth: string,
): boolean {
    if (!isRewardTargetMonth(employee, targetYearMonth)) return false;
    return targetYearMonth <= viewableYearMonthMax(employee, currentYearMonth);
}

export function clampViewableYearMonth(
    employee: Employee,
    targetYearMonth: string,
    currentYearMonth: string,
): string {
    const minYm = viewableYearMonthMin(employee);
    const maxYm = viewableYearMonthMax(employee, currentYearMonth);
    let ym = targetYearMonth;
    if (minYm && ym < minYm) ym = minYm;
    if (ym > maxYm) ym = maxYm;
    return ym;
}

export function listViewableYearMonths(employee: Employee, currentYearMonth: string): string[] {
    const minYm = viewableYearMonthMin(employee);
    const maxYm = viewableYearMonthMax(employee, currentYearMonth);
    if (!minYm) return [];

    const months: string[] = [];
    let ym = minYm;
    while (ym <= maxYm) {
        months.push(ym);
        ym = addMonthsToYearMonth(ym, 1);
    }
    return months;
}

export function viewableYearMonthReason(
    employee: Employee,
    targetYearMonth: string,
    currentYearMonth: string,
): string | null {
    if (isViewableYearMonth(employee, targetYearMonth, currentYearMonth)) return null;

    const joinReason = rewardTargetMonthReason(employee, targetYearMonth);
    if (joinReason) return joinReason;

    const maxYm = viewableYearMonthMax(employee, currentYearMonth);
    if (targetYearMonth > maxYm) {
        return `${formatYearMonthLabel(maxYm)}までの期間のみ確認できます。`;
    }

    return 'この月は確認できません。';
}

/** 入社月以降かつ退職月以前の年月なら報酬登録対象 */
export function isRewardTargetMonth(employee: Employee, targetYearMonth: string): boolean {
    if (!YEAR_MONTH_PATTERN.test(targetYearMonth)) return false;

    const joinYm = yearMonthFromDateString(employee.joinedDate);
    if (joinYm && targetYearMonth < joinYm) return false;

    const retireYm = yearMonthFromTimestamp(employee.retiredDate);
    if (retireYm && targetYearMonth > retireYm) return false;

    return true;
}

export function rewardTargetMonthReason(
    employee: Employee,
    targetYearMonth: string,
): string | null {
    if (isRewardTargetMonth(employee, targetYearMonth)) return null;

    const joinYm = yearMonthFromDateString(employee.joinedDate);
    if (joinYm && targetYearMonth < joinYm) {
        return `${formatYearMonthLabel(joinYm)}入社のため、この月は対象外です。`;
    }

    const retireYm = yearMonthFromTimestamp(employee.retiredDate);
    if (retireYm && targetYearMonth > retireYm) {
        return `${formatYearMonthLabel(retireYm)}退職のため、この月は対象外です。`;
    }

    return 'この月は報酬登録の対象外です。';
}

function formatYearMonthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    return `${y}年${Number(m)}月`;
}

function formatDateLabel(date: string): string {
    const [y, m, d] = date.split('-');
    return `${y}年${Number(m)}月${Number(d)}日`;
}

/** YYYY-MM に月数を加算（日は1日固定） */
export function addMonthsToYearMonth(ym: string, delta: number): string {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
