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
    const payrollPaymentMonthOffset =
        company.payrollPaymentMonthOffset ?? DEFAULT_COMPANY_PAYROLL_SETTINGS.payrollPaymentMonthOffset;

    const storedTiming = company.insurancePremiumCollectionTiming;
    let insurancePremiumCollectionTiming =
        storedTiming
        ?? resolveInsurancePremiumCollectionTiming(payrollPaymentMonthOffset);

    if (!isValidInsurancePremiumCollectionSetting(payrollPaymentMonthOffset, insurancePremiumCollectionTiming)) {
        insurancePremiumCollectionTiming = resolveInsurancePremiumCollectionTiming(payrollPaymentMonthOffset);
    }

    return {
        payrollClosingDay: company.payrollClosingDay ?? DEFAULT_COMPANY_PAYROLL_SETTINGS.payrollClosingDay,
        payrollPaymentDay: company.payrollPaymentDay ?? DEFAULT_COMPANY_PAYROLL_SETTINGS.payrollPaymentDay,
        payrollPaymentMonthOffset,
        insurancePremiumCollectionTiming,
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

export function formatConfiguredPayrollDayLabel(day: number | null): string {
    if (day === null) return '未設定';
    return formatPayrollDay(day);
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

/** 保険料徴収タイミングは給与支払月に連動（当月支払→当月徴収、翌月支払→翌月徴収） */
export function resolveInsurancePremiumCollectionTiming(
    payrollPaymentMonthOffset: 0 | 1,
): InsurancePremiumCollectionTiming {
    return payrollPaymentMonthOffset === 1 ? 'next_month' : 'same_month';
}

/**
 * 給与支払月・保険料徴収の組み合わせが有効か。
 * 保険料対象月は給与支払月以前である必要があり、
 * 給与を翌月支払いにしつつ当月徴収（支払月分の保険料を先に控除）は不可。
 */
export function isValidInsurancePremiumCollectionSetting(
    payrollPaymentMonthOffset: 0 | 1,
    timing: InsurancePremiumCollectionTiming,
): boolean {
    if (payrollPaymentMonthOffset === 1 && timing === 'same_month') {
        return false;
    }
    return true;
}

export function insurancePremiumCollectionSettingErrorMessage(
    payrollPaymentMonthOffset: 0 | 1,
    timing: InsurancePremiumCollectionTiming,
): string | null {
    if (isValidInsurancePremiumCollectionSetting(payrollPaymentMonthOffset, timing)) {
        return null;
    }
    return '給与支払が翌月の場合、当月徴収（支払月の保険料を控除）は選べません。翌月徴収を選択してください。';
}

/** 給与支払月に応じて選択可能な保険料徴収タイミング */
export function allowedInsurancePremiumCollectionTimings(
    payrollPaymentMonthOffset: 0 | 1,
): InsurancePremiumCollectionTiming[] {
    if (payrollPaymentMonthOffset === 1) {
        return ['next_month'];
    }
    return ['same_month', 'next_month'];
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
    return isValidOptionalPayrollDay(day);
}

/** 給与締日（未設定可） */
export function isValidOptionalPayrollDay(day: number | null): boolean {
    if (day === null) return true;
    return Number.isInteger(day) && day >= 1 && day <= 31;
}

/** 給与支払日（必須） */
export function isValidRequiredPayrollDay(day: number | null): boolean {
    return day !== null && Number.isInteger(day) && day >= 1 && day <= 31;
}

/** 指定年月の末日（month は 1〜12） */
export function lastDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

/**
 * 設定日（1〜31、31=末日）を、その月の暦日に解決する。
 * 設定日がその月に存在しない場合は月末日とする（例: 31日設定かつ4月 → 30日）。
 */
export function resolvePayrollDayInMonth(
    configuredDay: number,
    year: number,
    month: number,
): number {
    if (!Number.isInteger(configuredDay) || configuredDay < 1 || configuredDay > 31) {
        throw new Error('Invalid payroll day');
    }
    return Math.min(configuredDay, lastDayOfMonth(year, month));
}

/** 設定日を YYYY-MM-DD に解決する（month は 1〜12） */
export function resolvePayrollDateInMonth(
    configuredDay: number,
    year: number,
    month: number,
): string {
    const day = resolvePayrollDayInMonth(configuredDay, year, month);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 設定日を YYYY-MM-DD に解決する（yearMonth は YYYY-MM） */
export function resolvePayrollDateInYearMonth(
    configuredDay: number,
    yearMonth: string,
): string {
    const [yearText, monthText] = yearMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error('Invalid year month');
    }
    return resolvePayrollDateInMonth(configuredDay, year, month);
}
