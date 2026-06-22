import { insuranceJoinStatus } from '../models/social-insurance-status.model';
import {
    formatDateFromLocalDate,
    isInsurancePremiumTargetMonth,
    premiumEndYearMonthFromLossDate,
    premiumStartYearMonthFromAcquisitionDate,
    yearMonthFromDate,
} from './insurance-premium-period.util';

export type CareInsurancePeriod = {
    startDate: string | null;
    endDate: string | null;
    premiumStartYearMonth: string | null;
    premiumEndYearMonth: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export { formatDateFromLocalDate };

/** N歳の誕生日（YYYY-MM-DD） */
export function nthBirthday(birthDate: string, age: number): string | null {
    const trimmed = birthDate?.trim() ?? '';
    if (!DATE_PATTERN.test(trimmed)) return null;

    const [y, m, d] = trimmed.split('-').map(Number);
    const birthday = new Date(y + age, m - 1, d);
    if (Number.isNaN(birthday.getTime())) return null;

    return formatDateFromLocalDate(birthday);
}

/** N歳の誕生日の前日（YYYY-MM-DD） */
export function dayBeforeNthBirthday(birthDate: string, age: number): string | null {
    const trimmed = birthDate?.trim() ?? '';
    if (!DATE_PATTERN.test(trimmed)) return null;

    const [y, m, d] = trimmed.split('-').map(Number);
    const birthday = new Date(y + age, m - 1, d);
    if (Number.isNaN(birthday.getTime())) return null;

    birthday.setDate(birthday.getDate() - 1);
    return formatDateFromLocalDate(birthday);
}

export function maxDate(a: string | null | undefined, b: string | null | undefined): string | null {
    const left = a?.trim() || null;
    const right = b?.trim() || null;
    if (!left) return right;
    if (!right) return left;
    return left >= right ? left : right;
}

export function minDate(a: string | null | undefined, b: string | null | undefined): string | null {
    const left = a?.trim() || null;
    const right = b?.trim() || null;
    if (!left) return right;
    if (!right) return left;
    return left <= right ? left : right;
}

/** 介護保険の資格取得日 = max(健康保険資格取得日, 40歳誕生日の前日) */
export function computeCareInsuranceStartDate(
    healthInsuranceStartDate: string | null | undefined,
    birthDate: string | null | undefined,
): string | null {
    return maxDate(healthInsuranceStartDate, dayBeforeNthBirthday(birthDate?.trim() ?? '', 40));
}

/** 介護保険の資格喪失日 = min(健康保険資格喪失日, 65歳誕生日の前日) */
export function computeCareInsuranceEndDate(
    healthInsuranceEndDate: string | null | undefined,
    birthDate: string | null | undefined,
): string | null {
    return minDate(healthInsuranceEndDate, dayBeforeNthBirthday(birthDate?.trim() ?? '', 65));
}

export function computeCareInsurancePeriod(
    healthInsuranceStartDate: string | null | undefined,
    healthInsuranceEndDate: string | null | undefined,
    birthDate: string | null | undefined,
): CareInsurancePeriod {
    const startDate = computeCareInsuranceStartDate(healthInsuranceStartDate, birthDate);
    const endDate = computeCareInsuranceEndDate(healthInsuranceEndDate, birthDate);

    return {
        startDate,
        endDate,
        premiumStartYearMonth: premiumStartYearMonthFromAcquisitionDate(startDate),
        premiumEndYearMonth: premiumEndYearMonthFromLossDate(endDate),
    };
}

export function isCareInsurancePremiumTargetMonth(
    targetYearMonth: string,
    healthInsuranceStartDate: string | null | undefined,
    healthInsuranceEndDate: string | null | undefined,
    birthDate: string | null | undefined,
): boolean {
    const period = computeCareInsurancePeriod(
        healthInsuranceStartDate,
        healthInsuranceEndDate,
        birthDate,
    );
    if (!period.startDate) return false;

    return isInsurancePremiumTargetMonth(
        targetYearMonth,
        period.startDate,
        period.endDate,
    );
}

export function judgeCareInsuranceStatus(
    targetYearMonth: string,
    healthInsuranceStartDate: string | null | undefined,
    healthInsuranceEndDate: string | null | undefined,
    birthDate: string | null | undefined,
): insuranceJoinStatus {
    if (!birthDate?.trim()) return 'unknown';
    if (!computeCareInsuranceStartDate(healthInsuranceStartDate, birthDate)) return 'unknown';

    return isCareInsurancePremiumTargetMonth(
        targetYearMonth,
        healthInsuranceStartDate,
        healthInsuranceEndDate,
        birthDate,
    )
        ? 'active'
        : 'inactive';
}

export function currentYearMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 後方互換
export function careInsurancePremiumStartYearMonth(startDate: string | null | undefined): string | null {
    return premiumStartYearMonthFromAcquisitionDate(startDate);
}

export function careInsurancePremiumEndYearMonth(endDate: string | null | undefined): string | null {
    return premiumEndYearMonthFromLossDate(endDate);
}

export function yearMonthFromCareDate(date: string | null | undefined): string | null {
    return yearMonthFromDate(date);
}
