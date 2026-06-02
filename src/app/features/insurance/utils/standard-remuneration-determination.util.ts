import { Employee } from '../../employee/models/employee.models';
import {
    yearMonthFromDateString,
    yearMonthFromTimestamp,
} from './reward-target-month.util';

export type HealthInsuranceStartDateByEmployeeId = Record<string, string | null | undefined>;

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

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

/** 定時決定の平均に使う4〜6月（在籍期間内のみ） */
export function getRegularCalculationMonths(
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
