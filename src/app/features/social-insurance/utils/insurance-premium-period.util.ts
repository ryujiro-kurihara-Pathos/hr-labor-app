import { Timestamp } from 'firebase/firestore';

import { addMonthsToYearMonth } from '../../insurance/utils/reward-target-month.util';
import { formatYearMonthLabel } from '../../insurance/utils/standard-remuneration-determination.util';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type InsurancePremiumPeriod = {
    premiumStartYearMonth: string | null;
    premiumEndYearMonth: string | null;
};

export function formatDateFromLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function yearMonthFromDate(date: string | null | undefined): string | null {
    if (!date) return null;
    const ym = date.slice(0, 7);
    return /^\d{4}-\d{2}$/.test(ym) ? ym : null;
}

/** 資格取得日が属する月 */
export function premiumStartYearMonthFromAcquisitionDate(
    acquisitionDate: string | null | undefined,
): string | null {
    return yearMonthFromDate(acquisitionDate);
}

/** 資格喪失日が属する月の前月 */
export function premiumEndYearMonthFromLossDate(lossDate: string | null | undefined): string | null {
    const lossMonth = yearMonthFromDate(lossDate);
    if (!lossMonth) return null;
    return addMonthsToYearMonth(lossMonth, -1);
}

export function computeInsurancePremiumPeriod(
    acquisitionDate: string | null | undefined,
    lossDate: string | null | undefined,
): InsurancePremiumPeriod {
    return {
        premiumStartYearMonth: premiumStartYearMonthFromAcquisitionDate(acquisitionDate),
        premiumEndYearMonth: premiumEndYearMonthFromLossDate(lossDate),
    };
}

export function isInsurancePremiumTargetMonth(
    targetYearMonth: string,
    acquisitionDate: string | null | undefined,
    lossDate: string | null | undefined,
): boolean {
    const period = computeInsurancePremiumPeriod(acquisitionDate, lossDate);
    if (!period.premiumStartYearMonth) return false;
    if (targetYearMonth < period.premiumStartYearMonth) return false;
    if (period.premiumEndYearMonth && targetYearMonth > period.premiumEndYearMonth) return false;
    return true;
}

export function addDaysToDateString(date: string, days: number): string | null {
    if (!DATE_PATTERN.test(date)) return null;
    const [y, m, d] = date.split('-').map(Number);
    const next = new Date(y, m - 1, d);
    if (Number.isNaN(next.getTime())) return null;
    next.setDate(next.getDate() + days);
    return formatDateFromLocalDate(next);
}

/** 退職日の翌日を資格喪失日とする */
export function lossDateFromRetirementDate(retirementDate: string): string | null {
    return addDaysToDateString(retirementDate, 1);
}

export function dateStringFromTimestamp(ts: Timestamp | null | undefined): string | null {
    if (!ts) return null;
    return formatDateFromLocalDate(ts.toDate());
}

export function formatQualificationDateLabel(
    date: string | null | undefined,
    premiumYearMonth: string | null | undefined,
    monthPrefix: '開始月' | '終了月',
    formatDate: (value: string | null | undefined) => string,
): string {
    if (!date?.trim()) return '—';
    const formatted = formatDate(date);
    if (!premiumYearMonth) return formatted;
    return `${formatted}（${monthPrefix}${formatYearMonthLabel(premiumYearMonth)}）`;
}
