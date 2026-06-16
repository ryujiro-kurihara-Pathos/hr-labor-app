import { insuranceJoinStatus } from '../models/social-insurance-status.model';
import { dayBeforeNthBirthday, formatDateFromLocalDate, minDate } from './care-insurance-period.util';
import { isInsurancePremiumTargetMonth } from './insurance-premium-period.util';

export const HEALTH_INSURANCE_AGE_LIMIT = 75;
export const PENSION_INSURANCE_AGE_LIMIT = 70;

export function computeHealthInsurancePremiumEndDate(
    healthInsuranceEndDate: string | null | undefined,
    birthDate: string | null | undefined,
): string | null {
    const ageLimitEnd = birthDate?.trim()
        ? dayBeforeNthBirthday(birthDate.trim(), HEALTH_INSURANCE_AGE_LIMIT)
        : null;
    return minDate(healthInsuranceEndDate, ageLimitEnd);
}

export function computePensionInsurancePremiumEndDate(
    pensionInsuranceEndDate: string | null | undefined,
    birthDate: string | null | undefined,
): string | null {
    const ageLimitEnd = birthDate?.trim()
        ? dayBeforeNthBirthday(birthDate.trim(), PENSION_INSURANCE_AGE_LIMIT)
        : null;
    return minDate(pensionInsuranceEndDate, ageLimitEnd);
}

export function isHealthInsurancePremiumTargetMonth(
    targetYearMonth: string,
    healthInsuranceStartDate: string | null | undefined,
    healthInsuranceEndDate: string | null | undefined,
    birthDate: string | null | undefined,
): boolean {
    const endDate = computeHealthInsurancePremiumEndDate(healthInsuranceEndDate, birthDate);
    return isInsurancePremiumTargetMonth(targetYearMonth, healthInsuranceStartDate, endDate);
}

export function isPensionInsurancePremiumTargetMonth(
    targetYearMonth: string,
    healthInsuranceStartDate: string | null | undefined,
    healthInsuranceEndDate: string | null | undefined,
    pensionInsuranceStartDate: string | null | undefined,
    pensionInsuranceEndDate: string | null | undefined,
    birthDate: string | null | undefined,
): boolean {
    const startDate = pensionInsuranceStartDate?.trim() || healthInsuranceStartDate?.trim() || null;
    const enrollmentEndDate = pensionInsuranceEndDate?.trim() || healthInsuranceEndDate?.trim() || null;
    const endDate = computePensionInsurancePremiumEndDate(enrollmentEndDate, birthDate);
    return isInsurancePremiumTargetMonth(targetYearMonth, startDate, endDate);
}

/** 指定年齢の誕生日前日まで未満か（加入対象の年齢判定用） */
export function isUnderInsuranceAgeLimit(
    birthDate: string | null | undefined,
    limitAge: number,
    referenceDate: string = formatDateFromLocalDate(new Date()),
): boolean | null {
    if (!birthDate?.trim()) return null;
    const limitEnd = dayBeforeNthBirthday(birthDate.trim(), limitAge);
    if (!limitEnd) return null;
    return referenceDate <= limitEnd;
}

/** 社会保険の加入要件を満たしたうえで、年齢上限以内か判定する */
export function judgeInsuranceJoinStatusWithAgeLimit(
    employmentStatus: insuranceJoinStatus,
    birthDate: string | null | undefined,
    limitAge: number,
): insuranceJoinStatus {
    if (employmentStatus !== 'active') return employmentStatus;
    const underLimit = isUnderInsuranceAgeLimit(birthDate, limitAge);
    if (underLimit === null) return 'unknown';
    return underLimit ? 'active' : 'inactive';
}

export function judgeHealthInsuranceJoinStatus(
    employmentStatus: insuranceJoinStatus,
    birthDate: string | null | undefined,
): insuranceJoinStatus {
    return judgeInsuranceJoinStatusWithAgeLimit(
        employmentStatus,
        birthDate,
        HEALTH_INSURANCE_AGE_LIMIT,
    );
}

export function judgePensionInsuranceJoinStatus(
    employmentStatus: insuranceJoinStatus,
    birthDate: string | null | undefined,
): insuranceJoinStatus {
    return judgeInsuranceJoinStatusWithAgeLimit(
        employmentStatus,
        birthDate,
        PENSION_INSURANCE_AGE_LIMIT,
    );
}
