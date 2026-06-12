import { EmploymentType } from '../../employee/models/employee.models';
import { SocialInsuranceStatus } from '../models/social-insurance-status.model';

export type PartTimeJudgmentField =
    | 'weeklyScheduledWorkHours'
    | 'monthlyScheduledWorkDays'
    | 'prescribedWage';

export type PartTimeInsuranceJudgmentInput = {
    weeklyScheduledWorkHours: number | null;
    monthlyScheduledWorkDays: number | null;
    prescribedWage: number | null;
};

export const PART_TIME_JUDGMENT_FIELD_LABELS: Record<PartTimeJudgmentField, string> = {
    weeklyScheduledWorkHours: '週の所定労働時間',
    monthlyScheduledWorkDays: '月の所定労働日数',
    prescribedWage: '所定内賃金',
};

export const PART_TIME_JUDGMENT_CONTEXT_LABELS = [
    '週の所定労働時間',
    '月の所定労働日数',
    '所定内賃金',
    '学生区分',
    '2か月を超える雇用見込み',
] as const;

export function isPartTimeEmployment(employmentType: EmploymentType): boolean {
    return employmentType === 'part-time';
}

export function parseJudgmentNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
}

export function partTimeJudgmentInputFromStatus(
    status: SocialInsuranceStatus | null | undefined,
): PartTimeInsuranceJudgmentInput {
    return {
        weeklyScheduledWorkHours: status?.weeklyScheduledWorkHours ?? null,
        monthlyScheduledWorkDays: status?.monthlyScheduledWorkDays ?? null,
        prescribedWage: status?.prescribedWage ?? null,
    };
}

export function getMissingPartTimeJudgmentFields(
    input: PartTimeInsuranceJudgmentInput,
): PartTimeJudgmentField[] {
    const missing: PartTimeJudgmentField[] = [];

    if (input.weeklyScheduledWorkHours === null) {
        missing.push('weeklyScheduledWorkHours');
    }
    if (input.monthlyScheduledWorkDays === null) {
        missing.push('monthlyScheduledWorkDays');
    }
    if (input.prescribedWage === null) {
        missing.push('prescribedWage');
    }

    return missing;
}

export function canJudgePartTimeInsurance(input: PartTimeInsuranceJudgmentInput): boolean {
    return getMissingPartTimeJudgmentFields(input).length === 0;
}

export function formatMissingPartTimeJudgmentFieldLabels(fields: PartTimeJudgmentField[]): string {
    return fields.map((field) => PART_TIME_JUDGMENT_FIELD_LABELS[field]).join('、');
}

export function needsPartTimeInsuranceJudgmentWarning(
    employmentType: EmploymentType,
    status: SocialInsuranceStatus | null | undefined,
): boolean {
    if (!isPartTimeEmployment(employmentType)) return false;
    return !canJudgePartTimeInsurance(partTimeJudgmentInputFromStatus(status));
}

export function partTimeInsuranceJudgmentWarningMessage(
    missingFields: PartTimeJudgmentField[],
): string {
    const base =
        'パート・アルバイトの社会保険加入対象を判定するには、労働条件（週の所定労働時間、月の所定労働日数、所定内賃金、学生区分、2か月を超える雇用見込み）の入力が必要です。';

    if (missingFields.length === 0) return base;

    return `${base}未入力: ${formatMissingPartTimeJudgmentFieldLabels(missingFields)}`;
}
