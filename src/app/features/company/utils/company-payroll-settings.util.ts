import { addMonthsToYearMonth } from '../../insurance/utils/reward-target-month.util';
import { formatYearMonthLabel } from '../../insurance/utils/standard-remuneration-determination.util';
import {
    APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
    Company,
    DEFAULT_COMPANY_PAYROLL_SETTINGS,
    InsurancePremiumCollectionTiming,
} from '../models/company.model';

export function normalizeCompanyPayrollSettings(
    company: Partial<Company>,
): Pick<Company, 'payrollPaymentMonthOffset' | 'insurancePremiumCollectionTiming'> {
    const payrollPaymentMonthOffset =
        company.payrollPaymentMonthOffset ?? DEFAULT_COMPANY_PAYROLL_SETTINGS.payrollPaymentMonthOffset;

    return {
        payrollPaymentMonthOffset,
        insurancePremiumCollectionTiming: APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
    };
}

export function normalizeCompany(company: Partial<Company> & { id: string }): Company {
    return {
        ...company,
        ...normalizeCompanyPayrollSettings(company),
    } as Company;
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

/**
 * 保険料算定に参照する標準報酬月額の決定月（支給年月）。
 * 当月徴収: 給与控除月と同じ。
 * 翌月徴収: 給与控除月の前月（その給与から控除する保険料の対象月に合わせる）。
 * 例）随時改定が9月支給から適用 → 翌月徴収では10月給与控除（9月分）から新標準を反映。
 */
export function resolvePremiumStandardDeterminationYearMonth(
    payYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
): string {
    return resolvePremiumLiabilityYearMonth(payYearMonth, timing);
}

/**
 * 随時改定の標準報酬適用支給月から、保険料額に初めて反映される給与控除月を返す。
 */
export function resolvePremiumDeductionApplyFromPayMonth(
    revisionApplyFromPayMonth: string,
    timing: InsurancePremiumCollectionTiming,
): string {
    return timing === 'next_month'
        ? addMonthsToYearMonth(revisionApplyFromPayMonth, 1)
        : revisionApplyFromPayMonth;
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

/**
 * 翌月徴収で根拠月が入社前のため、給与控除月に月次保険料がない場合の説明。
 * 控除月が入社月のときは入社月向けの文言を返す。
 */
export function formatZeroPremiumBeforeEmploymentReason(params: {
    payYearMonth: string;
    joinYearMonth: string | null;
    liabilityYearMonth: string | null;
}): string | null {
    const { payYearMonth, joinYearMonth, liabilityYearMonth } = params;
    if (!joinYearMonth || !liabilityYearMonth || liabilityYearMonth >= joinYearMonth) {
        return null;
    }

    const payLabel = formatYearMonthLabel(payYearMonth);
    const nextPayLabel = formatYearMonthLabel(addMonthsToYearMonth(payYearMonth, 1));

    if (payYearMonth === joinYearMonth) {
        return `${payLabel}は入社月のため、この月の給与から控除する保険料はありません。${nextPayLabel}を選ぶと、${payLabel}分の保険料が表示されます。`;
    }

    return `この月の給与から控除する保険料はありません。${nextPayLabel}を選ぶと、${payLabel}の報酬に基づく保険料が表示されます。`;
}
