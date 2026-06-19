import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { KYOKAI_HEALTH_INSURANCE_RATE_FILES } from '../../insurance-rate/data/insurance-rates';
import { findCareInsuranceRate, findHealthInsuranceRate } from '../../insurance-rate/utils/insurance-rate-lookup.util';
import { resolveOfficePrefecture } from '../../company/utils/office-prefecture.util';
import { ManualInsurancePremiumRates } from '../models/manual-insurance-premium-rate.model';

/** 組み込み料率データの適用開始月（これより前は自動料率なし） */
export const AUTOMATIC_INSURANCE_RATE_AVAILABLE_FROM = '2024-03';

export const DEFAULT_PENSION_INSURANCE_RATE = 0.0915;

export type ResolvedInsurancePremiumRates = {
    healthEmployeeRate: number | null;
    healthEmployerRate: number | null;
    careEmployeeRate: number | null;
    careEmployerRate: number | null;
    pensionEmployeeRate: number | null;
    pensionEmployerRate: number | null;
    needsManualHealthRate: boolean;
    needsManualCareRate: boolean;
    needsManualPensionRate: boolean;
};

export function healthInsuranceFiscalYear(targetYearMonth: string): string {
    const [y, m] = targetYearMonth.split('-').map(Number);
    return m < 3 ? String(y - 1) : String(y);
}

export function lookupAutomaticHealthInsuranceRate(params: {
    liabilityYearMonth: string;
    office: Office | null;
    employee: Employee;
}): { employeeRate: number; employerRate: number } | null {
    const fiscalYear = healthInsuranceFiscalYear(params.liabilityYearMonth);
    const fileName = `kyokai-health-insurance-rates-${fiscalYear}-03.ts`;
    const rates =
        KYOKAI_HEALTH_INSURANCE_RATE_FILES.find((file) => file.fileName === fileName)?.rates ?? [];

    const row = findHealthInsuranceRate({
        rates,
        targetYearMonth: params.liabilityYearMonth,
        providerType: params.office?.healthInsuranceType ?? 'kyokai',
        prefecture: resolveOfficePrefecture(params.office, params.employee.prefecture),
    });

    if (!row) return null;
    return { employeeRate: row.employeeRate, employerRate: row.employerRate };
}

export function lookupAutomaticCareInsuranceRate(
    liabilityYearMonth: string,
): { employeeRate: number; employerRate: number } | null {
    const row = findCareInsuranceRate(liabilityYearMonth);
    if (!row) return null;
    return { employeeRate: row.employeeRate, employerRate: row.employerRate };
}

export function lookupAutomaticPensionInsuranceRate(liabilityYearMonth: string): number | null {
    if (liabilityYearMonth < AUTOMATIC_INSURANCE_RATE_AVAILABLE_FROM) return null;
    return DEFAULT_PENSION_INSURANCE_RATE;
}

export function resolveInsurancePremiumRates(params: {
    liabilityYearMonth: string;
    office: Office | null;
    employee: Employee;
    manualRates: ManualInsurancePremiumRates | null;
}): ResolvedInsurancePremiumRates {
    const autoHealth = lookupAutomaticHealthInsuranceRate({
        liabilityYearMonth: params.liabilityYearMonth,
        office: params.office,
        employee: params.employee,
    });
    const autoCare = lookupAutomaticCareInsuranceRate(params.liabilityYearMonth);
    const autoPension = lookupAutomaticPensionInsuranceRate(params.liabilityYearMonth);

    const needsManualHealthRate = autoHealth === null;
    const needsManualCareRate = autoCare === null;
    const needsManualPensionRate = autoPension === null;

    const manual = params.manualRates;

    return {
        healthEmployeeRate: autoHealth?.employeeRate ?? manual?.healthEmployeeRate ?? null,
        healthEmployerRate: autoHealth?.employerRate ?? manual?.healthEmployerRate ?? null,
        careEmployeeRate: autoCare?.employeeRate ?? manual?.careEmployeeRate ?? null,
        careEmployerRate: autoCare?.employerRate ?? manual?.careEmployerRate ?? null,
        pensionEmployeeRate: autoPension ?? manual?.pensionEmployeeRate ?? null,
        pensionEmployerRate: autoPension ?? manual?.pensionEmployerRate ?? null,
        needsManualHealthRate,
        needsManualCareRate,
        needsManualPensionRate,
    };
}

export function decimalRateToPercentInput(rate: number | null | undefined): number | '' {
    if (rate === null || rate === undefined || !Number.isFinite(rate)) return '';
    return Number((rate * 100).toFixed(4));
}

export function percentInputToDecimalRate(percent: number | ''): number | null {
    if (percent === '' || !Number.isFinite(Number(percent))) return null;
    const value = Number(percent);
    if (value < 0) return null;
    return value / 100;
}

/** 本人・会社同率（折半）の料率ペア */
export function manualRatePairFromPercent(
    percent: number | '',
): { employeeRate: number | null; employerRate: number | null } {
    const rate = percentInputToDecimalRate(percent);
    if (rate === null) return { employeeRate: null, employerRate: null };
    return { employeeRate: rate, employerRate: rate };
}

export function savedRateToPercentInput(
    employeeRate: number | null | undefined,
    employerRate: number | null | undefined,
): number | '' {
    return decimalRateToPercentInput(employeeRate ?? employerRate);
}

export function manualRatesMissingMessage(resolved: ResolvedInsurancePremiumRates): string | null {
    const missing: string[] = [];
    if (resolved.needsManualHealthRate && resolved.healthEmployeeRate === null) {
        missing.push('健康保険');
    }
    if (resolved.needsManualCareRate && resolved.careEmployeeRate === null) {
        missing.push('介護保険');
    }
    if (resolved.needsManualPensionRate && resolved.pensionEmployeeRate === null) {
        missing.push('厚生年金');
    }
    if (missing.length === 0) return null;
    return `${missing.join('・')}の料率データがありません。手動で入力してください。`;
}
