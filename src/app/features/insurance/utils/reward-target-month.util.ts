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

export function currentYearMonth(date: Date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 給与入力の上限：現在月の翌月。退職予定月がそれより前なら退職月まで */
export function inputableYearMonthMax(employee: Employee, referenceYearMonth: string): string {
    const forwardLimit = addMonthsToYearMonth(referenceYearMonth, 1);
    const retireYm = yearMonthFromTimestamp(employee.retiredDate);
    if (retireYm && retireYm < forwardLimit) return retireYm;
    return forwardLimit;
}

/** 入社月〜入力上限まで閲覧・ナビ可能 */
export function viewableYearMonthMax(employee: Employee, referenceYearMonth: string): string {
    return inputableYearMonthMax(employee, referenceYearMonth);
}

/** 月ナビの上限（viewableYearMonthMax と同じ） */
export function navigableYearMonthMax(
    employee: Employee,
    referenceYearMonth: string = currentYearMonth(),
): string {
    return inputableYearMonthMax(employee, referenceYearMonth);
}

export function viewableYearMonthMin(employee: Employee): string | null {
    return yearMonthFromDateString(employee.joinedDate);
}

/** 入社月〜入力上限の範囲内か */
export function isViewableYearMonth(
    employee: Employee,
    targetYearMonth: string,
    referenceYearMonth: string,
): boolean {
    return isRewardTargetMonth(employee, targetYearMonth, referenceYearMonth);
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

    return rewardTargetMonthReason(employee, targetYearMonth, currentYearMonth);
}

/** 入社月〜現在月の翌月（退職予定月があればその月まで）なら報酬登録対象 */
export function isRewardTargetMonth(
    employee: Employee,
    targetYearMonth: string,
    referenceYearMonth: string = currentYearMonth(),
): boolean {
    if (!YEAR_MONTH_PATTERN.test(targetYearMonth)) return false;

    const joinYm = yearMonthFromDateString(employee.joinedDate);
    if (joinYm && targetYearMonth < joinYm) return false;

    const retireYm = yearMonthFromTimestamp(employee.retiredDate);
    if (retireYm && targetYearMonth > retireYm) return false;

    if (targetYearMonth > inputableYearMonthMax(employee, referenceYearMonth)) return false;

    return true;
}

export function rewardTargetMonthReason(
    employee: Employee,
    targetYearMonth: string,
    referenceYearMonth: string = currentYearMonth(),
): string | null {
    if (isRewardTargetMonth(employee, targetYearMonth, referenceYearMonth)) return null;

    const joinYm = yearMonthFromDateString(employee.joinedDate);
    if (joinYm && targetYearMonth < joinYm) {
        return `${formatYearMonthLabel(joinYm)}入社のため、この月は対象外です。`;
    }

    const retireYm = yearMonthFromTimestamp(employee.retiredDate);
    if (retireYm && targetYearMonth > retireYm) {
        return `${formatYearMonthLabel(retireYm)}退職のため、この月は対象外です。`;
    }

    const maxYm = inputableYearMonthMax(employee, referenceYearMonth);
    if (targetYearMonth > maxYm) {
        return `${formatYearMonthLabel(maxYm)}まで入力できます。`;
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
