import { Timestamp } from 'firebase/firestore';

import { Employee } from '../../employee/models/employee.models';

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

/** 在籍中は当月、退職済みは退職月まで閲覧可能 */
export function viewableYearMonthMax(employee: Employee, currentYearMonth: string): string {
    const retireYm = yearMonthFromTimestamp(employee.retiredDate);
    if (retireYm) return retireYm;
    return currentYearMonth;
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

/** YYYY-MM に月数を加算（日は1日固定） */
export function addMonthsToYearMonth(ym: string, delta: number): string {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
