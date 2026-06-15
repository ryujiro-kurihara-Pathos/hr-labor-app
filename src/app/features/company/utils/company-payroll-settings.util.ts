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

/**
 * 保険料画面で選択中の年月（給与控除月）から、保険料の対象月（何月分か）を返す。
 * 翌月徴収の場合、5月表示 → 4月分の保険料。
 */
export function resolvePremiumLiabilityYearMonth(
    displayYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
): string {
    return timing === 'next_month'
        ? addMonthsToYearMonth(displayYearMonth, -1)
        : displayYearMonth;
}

/** 給与控除を行う年月（画面の選択月） */
export function resolvePayrollDeductionYearMonth(
    displayYearMonth: string,
    _timing: InsurancePremiumCollectionTiming,
): string {
    return displayYearMonth;
}

export function formatPayrollDeductionNote(
    displayYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
): string {
    const deductionYearMonth = resolvePayrollDeductionYearMonth(displayYearMonth, timing);
    const timingLabel = insurancePremiumCollectionTimingLabel(timing);
    return `${formatYearMonthLabel(deductionYearMonth)}の給与から控除（${timingLabel}）`;
}

/** 対象月の保険料を何月の給与から控除するかを説明する */
export function formatPremiumCollectionSummary(
    displayYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
): string {
    const deductionLabel = formatYearMonthLabel(displayYearMonth);
    if (timing === 'same_month') {
        return `${deductionLabel}分の保険料を、${deductionLabel}の給与から控除します（当月徴収）。`;
    }

    const liabilityLabel = formatYearMonthLabel(
        resolvePremiumLiabilityYearMonth(displayYearMonth, timing),
    );
    return `${liabilityLabel}分の保険料を、${deductionLabel}の給与から控除します（翌月徴収）。`;
}

export function isValidPayrollDay(day: number | null): boolean {
    if (day === null) return true;
    return Number.isInteger(day) && day >= 1 && day <= 31;
}
