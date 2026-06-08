import { Timestamp } from 'firebase/firestore';

import { Employee } from '../../employee/models/employee.models';
import {
    yearMonthFromDateString,
    yearMonthFromTimestamp,
} from './reward-target-month.util';

export type HealthInsuranceStartDateByEmployeeId = Record<string, string | null | undefined>;

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** 定時決定の平均算定に必要な支払基礎日数の下限 */
export const REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS = 17;

/** 資格取得日（健康保険開始日があれば優先、なければ入社日） */
export function getQualificationDate(
    employee: Employee,
    healthInsuranceStartDate?: string | null,
): string | null {
    const fromInsurance = healthInsuranceStartDate?.trim();
    if (fromInsurance && fromInsurance.length >= 10) return fromInsurance;
    const joined = employee.joinedDate?.trim();
    if (joined && joined.length >= 10) return joined;
    return null;
}

/**
 * 初回の定時決定が適用される9月の年。
 * 5/31以前の資格取得 → 当年9月、6/1以降 → 翌年9月。
 */
export function getFirstRegularDeterminationSeptemberYear(qualificationDate: string): number {
    const month = Number.parseInt(qualificationDate.slice(5, 7), 10);
    const day = Number.parseInt(qualificationDate.slice(8, 10), 10);
    const year = Number.parseInt(qualificationDate.slice(0, 4), 10);

    if (month > 6 || (month === 6 && day >= 1)) {
        return year + 1;
    }
    return year;
}

export function getFirstRegularDeterminationYearMonth(qualificationDate: string): string {
    const year = getFirstRegularDeterminationSeptemberYear(qualificationDate);
    return `${year}-09`;
}

/** 定時決定サイクル（9月〜翌8月）の算定対象年（4〜6月が属する年） */
export function getRegularDeterminationBaseYear(targetYearMonth: string): number {
    const [y, m] = targetYearMonth.split('-').map(Number);
    return m >= 9 ? y : y - 1;
}

export function getAprJunYearMonths(baseYear: number): string[] {
    return [`${baseYear}-04`, `${baseYear}-05`, `${baseYear}-06`];
}

export function getDeterminationType(
    qualificationDate: string,
    targetYearMonth: string,
): 'initial' | 'regular' {
    const firstRegularYm = getFirstRegularDeterminationYearMonth(qualificationDate);
    return targetYearMonth < firstRegularYm ? 'initial' : 'regular';
}

/** 定時決定の算定基礎対象となる4〜6月（在籍期間内のみ） */
export function getRegularBaseMonths(
    employee: Employee,
    baseYear: number,
    qualificationDate: string,
): string[] {
    const joinYm = yearMonthFromDateString(qualificationDate);
    const retireYm = yearMonthFromTimestamp(employee.retiredDate);

    return getAprJunYearMonths(baseYear).filter((ym) => {
        if (joinYm && ym < joinYm) return false;
        if (retireYm && ym > retireYm) return false;
        return true;
    });
}

/** 定時決定の平均算定に使う4〜6月（支払基礎日数17日以上） */
export function getRegularCalculationMonths(
    employee: Employee,
    baseYear: number,
    qualificationDate: string,
): string[] {
    return getRegularBaseMonths(employee, baseYear, qualificationDate).filter(
        (ym) =>
            getPaymentBaseDays(ym, qualificationDate, employee.retiredDate) >=
            REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
    );
}

/** 対象月の支払基礎日数（資格取得日〜退職日ベース） */
export function getPaymentBaseDays(
    yearMonth: string,
    qualificationDate: string,
    retiredDate: Timestamp | null,
): number {
    const joinYm = yearMonthFromDateString(qualificationDate);
    const retireYm = yearMonthFromTimestamp(retiredDate);
    if (joinYm && yearMonth < joinYm) return 0;
    if (retireYm && yearMonth > retireYm) return 0;

    return getEnrolledDaysInMonth(yearMonth, qualificationDate, retiredDate);
}

/** 指定年月における支払基礎日数（在籍日数）を返す */
function getEnrolledDaysInMonth(
    yearMonth: string,
    qualificationDate: string,
    retiredDate: Timestamp | null,
): number {
    const monthStart = toDate(`${yearMonth}-01`);
    const monthEnd = getLastDateOfMonth(yearMonth);

    const qualification = toDate(qualificationDate);
    const retired = timestampToDate(retiredDate);

    const startDate = qualification > monthStart ? qualification : monthStart;
    const endDate = retired && retired < monthEnd ? retired : monthEnd;

    if (startDate > endDate) return 0;

    return differenceInDaysInclusive(startDate, endDate);
}

/** yyyy-MM-dd を Date に変換 */
function toDate(dateString: string): Date {
    return new Date(`${dateString}T00:00:00`);
}

function timestampToDate(value: Timestamp | null): Date | null {
    if (!value) return null;
    return value.toDate();
}

/** 指定年月の月末日を返す */
function getLastDateOfMonth(yearMonth: string): Date {
    const [year, month] = yearMonth.split('-').map(Number);

    // month は 1〜12、Date の月は 0〜11
    // new Date(year, month, 0) でその月の末日になる
    return new Date(year, month, 0);
}

/** 開始日と終了日を含めた日数を返す */
function differenceInDaysInclusive(startDate: Date, endDate: Date): number {
    const start = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
    );

    const end = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
    );

    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function formatYearMonthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    return `${y}年${Number(m)}月`;
}

export function formatYearMonthList(labels: string[]): string {
    return labels.map(formatYearMonthLabel).join('・');
}

/** 一覧取得用：対象月の解決に必要な年月リスト */
export function collectRewardMonthsToFetch(
    targetYearMonth: string,
    employees: Employee[],
    healthInsuranceStartDateByEmployeeId: HealthInsuranceStartDateByEmployeeId = {},
): string[] {
    const months = new Set<string>([targetYearMonth]);

    const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
    for (const ym of getAprJunYearMonths(baseYear)) {
        months.add(ym);
    }

    for (const employee of employees) {
        const qualificationDate = getQualificationDate(
            employee,
            healthInsuranceStartDateByEmployeeId[employee.id],
        );
        const qualificationYm = qualificationDate
            ? yearMonthFromDateString(qualificationDate)
            : yearMonthFromDateString(employee.joinedDate);
        if (qualificationYm) months.add(qualificationYm);
    }

    return [...months].filter((ym) => YEAR_MONTH_PATTERN.test(ym)).sort();
}
