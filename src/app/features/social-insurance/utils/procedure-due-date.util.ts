import { LossReason } from '../models/procedures.model';
import { resolveLossDate } from './procedure-display.util';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 事実発生から届出可能な日数（翌日から起算して5日以内の最終日 = 発生日 + 5日） */
export const PROCEDURE_SUBMISSION_DEADLINE_DAYS = 5;

/** 定時決定（算定基礎届）の提出開始日（毎年7月1日） */
export const REGULAR_DECISION_SUBMISSION_START_MONTH_DAY = '07-01';

/** 定時決定（算定基礎届）の提出期限（毎年7月10日） */
export const REGULAR_DECISION_DUE_MONTH_DAY = '07-10';

/** YYYY-MM-DD に日数を加算 */
export function addDaysToDateString(dateString: string, days: number): string | null {
    if (!DATE_PATTERN.test(dateString)) return null;
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** 事実発生日から届出期限（発生日 + 5日） */
export function procedureDueDateFromOccurredDate(occurredDate: string | null | undefined): string {
    const trimmed = occurredDate?.trim() ?? '';
    if (!trimmed) return '';
    const dueDate = addDaysToDateString(trimmed, PROCEDURE_SUBMISSION_DEADLINE_DAYS);
    return dueDate ?? '';
}

/** 資格取得届の対応期限（資格取得日から5日後） */
export function qualificationProcedureDueDate(qualificationDate: string): string {
    return procedureDueDateFromOccurredDate(qualificationDate);
}

function resolveRegularDecisionDeterminationYear(determinationYear: number | string): number | null {
    const year =
        typeof determinationYear === 'number'
            ? determinationYear
            : Number(String(determinationYear).slice(0, 4));
    if (!Number.isFinite(year) || year <= 0) return null;
    return year;
}

/** 定時決定（算定基礎届）の提出開始日（算定対象年の7月1日） */
export function regularDecisionProcedureSubmissionStartDate(determinationYear: number | string): string {
    const year = resolveRegularDecisionDeterminationYear(determinationYear);
    if (year === null) return '';
    return `${year}-${REGULAR_DECISION_SUBMISSION_START_MONTH_DAY}`;
}

/** 定時決定（算定基礎届）の提出期限（算定対象年の7月10日） */
export function regularDecisionProcedureDueDate(determinationYear: number | string): string {
    const year = resolveRegularDecisionDeterminationYear(determinationYear);
    if (year === null) return '';
    return `${year}-${REGULAR_DECISION_DUE_MONTH_DAY}`;
}

/** 算定基礎届を提出できる期間（算定対象年の7月1日〜7月10日）か */
export function isRegularDecisionProcedureSubmissionAllowed(
    determinationYear: number | string,
    referenceDate: string,
): boolean {
    const startDate = regularDecisionProcedureSubmissionStartDate(determinationYear);
    const dueDate = regularDecisionProcedureDueDate(determinationYear);
    if (!DATE_PATTERN.test(referenceDate) || !startDate || !dueDate) return false;
    return referenceDate >= startDate && referenceDate <= dueDate;
}

/**
 * 算定基礎届を提出できるか（期間内、または提出期限を過ぎた過去分）。
 * 提出開始前は不可。
 */
export function canSubmitRegularDecisionProcedure(
    determinationYear: number | string,
    referenceDate: string,
): boolean {
    if (isRegularDecisionProcedureSubmissionAllowed(determinationYear, referenceDate)) {
        return true;
    }

    const dueDate = regularDecisionProcedureDueDate(determinationYear);
    if (!DATE_PATTERN.test(referenceDate) || !dueDate) return false;
    return referenceDate > dueDate;
}

export function resolveLossProcedureOccurredAndDueDate(params: {
    retirementDate?: string | null;
    lossReason?: LossReason | null;
    healthInsuranceEndDate?: string | null;
    pensionInsuranceEndDate?: string | null;
    occurredDate?: string | null;
}): { occurredDate: string; dueDate: string } {
    const lossDate = resolveLossDate(
        params.healthInsuranceEndDate,
        params.pensionInsuranceEndDate,
        params.occurredDate,
        {
            lossReason: params.lossReason,
            retiredDate: params.retirementDate,
        },
    );
    const occurredDate =
        lossDate?.trim() ||
        params.retirementDate?.trim() ||
        params.occurredDate?.trim() ||
        '';
    return {
        occurredDate,
        dueDate: procedureDueDateFromOccurredDate(occurredDate),
    };
}

export function resolveDependentChangeOccurredAndDueDate(params: {
    changeType: 'add' | 'change' | 'delete';
    changeDate?: string | null;
    dependencyStartDate?: string | null;
    dependencyEndDate?: string | null;
}): { occurredDate: string; dueDate: string } | null {
    const occurredDate =
        params.changeType === 'add'
            ? params.dependencyStartDate?.trim() ?? ''
            : params.changeType === 'delete'
              ? params.dependencyEndDate?.trim() ?? ''
              : params.changeDate?.trim() ?? '';
    if (!occurredDate) return null;
    return {
        occurredDate,
        dueDate: procedureDueDateFromOccurredDate(occurredDate),
    };
}
