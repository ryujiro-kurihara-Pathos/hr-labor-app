import { addMonthsToYearMonth } from '../../insurance/utils/reward-target-month.util';
import { formatYearMonthLabel } from '../../insurance/utils/standard-remuneration-determination.util';
import {
    Company,
    DEFAULT_COMPANY_PAYROLL_SETTINGS,
    InsurancePremiumCollectionTiming,
} from '../models/company.model';

export function normalizeCompanyPayrollSettings(
    company: Partial<Company>,
): Pick<
    Company,
    | 'payrollClosingDay'
    | 'payrollPaymentDay'
    | 'payrollPaymentMonthOffset'
    | 'insurancePremiumCollectionTiming'
> {
    return {
        payrollClosingDay: company.payrollClosingDay ?? DEFAULT_COMPANY_PAYROLL_SETTINGS.payrollClosingDay,
        payrollPaymentDay: company.payrollPaymentDay ?? DEFAULT_COMPANY_PAYROLL_SETTINGS.payrollPaymentDay,
        payrollPaymentMonthOffset:
            company.payrollPaymentMonthOffset ?? DEFAULT_COMPANY_PAYROLL_SETTINGS.payrollPaymentMonthOffset,
        insurancePremiumCollectionTiming:
            company.insurancePremiumCollectionTiming
            ?? DEFAULT_COMPANY_PAYROLL_SETTINGS.insurancePremiumCollectionTiming,
    };
}

export function normalizeCompany(company: Partial<Company> & { id: string }): Company {
    return {
        ...company,
        ...normalizeCompanyPayrollSettings(company),
    } as Company;
}

export function formatPayrollDay(day: number): string {
    return day === 31 ? '末日' : `${day}日`;
}

export function formatPayrollClosingDayLabel(day: number | null): string {
    if (day === null) return '未設定';
    return `毎月${formatPayrollDay(day)}`;
}

export function formatPayrollPaymentDayLabel(
    day: number | null,
    monthOffset: 0 | 1,
): string {
    if (day === null) return '未設定';
    const monthLabel = monthOffset === 1 ? '翌月' : '当月';
    return `${monthLabel}${formatPayrollDay(day)}`;
}

export function insurancePremiumCollectionTimingLabel(
    timing: InsurancePremiumCollectionTiming,
): string {
    return timing === 'same_month' ? '当月徴収' : '翌月徴収';
}

export function resolvePayrollDeductionYearMonth(
    targetYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
): string {
    return timing === 'next_month'
        ? addMonthsToYearMonth(targetYearMonth, 1)
        : targetYearMonth;
}

export function formatPayrollDeductionNote(
    targetYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
): string {
    const deductionYearMonth = resolvePayrollDeductionYearMonth(targetYearMonth, timing);
    const timingLabel = insurancePremiumCollectionTimingLabel(timing);
    return `${formatYearMonthLabel(deductionYearMonth)}の給与から控除（${timingLabel}）`;
}

export function isValidPayrollDay(day: number | null): boolean {
    if (day === null) return true;
    return Number.isInteger(day) && day >= 1 && day <= 31;
}
