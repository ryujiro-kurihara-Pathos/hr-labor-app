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
