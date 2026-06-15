import { dayBeforeNthBirthday, minDate } from './care-insurance-period.util';
import { isInsurancePremiumTargetMonth } from './insurance-premium-period.util';

const HEALTH_INSURANCE_AGE_LIMIT = 75;
const PENSION_INSURANCE_AGE_LIMIT = 70;

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
