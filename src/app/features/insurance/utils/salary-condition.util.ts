import { Employee } from '../../employee/models/employee.models';
import {
    SalaryCondition,
    SalaryConditionFixedWageFields,
    SalaryConditionFormValue,
    SalaryConditionInput,
    SalaryConditionPeriod,
} from '../models/salary-condition.model';
import { StandardMonthlyReward, StandardMonthlyRewardStatus } from '../models/standard-monthly-reward.model';
import {
    FIXED_WAGE_FIELD_KEYS,
    sumFixedWageFields,
} from './fixed-wage-change.util';
import { addMonthsToYearMonth, yearMonthFromDateString } from './reward-target-month.util';
import { formatYearMonthLabel } from './standard-remuneration-determination.util';

export function salaryConditionDocId(employeeId: string, effectiveStartMonth: string): string {
    return `${employeeId}_${effectiveStartMonth}`;
}

export function fixedWageFieldsFromSalaryCondition(
    condition: SalaryConditionFixedWageFields,
): SalaryConditionFixedWageFields {
    return {
        basicSalary: condition.basicSalary,
        commutingAllowance: condition.commutingAllowance,
        positionAllowance: condition.positionAllowance,
        housingAllowance: condition.housingAllowance,
        fixedOvertimePay: condition.fixedOvertimePay,
        otherFixedAllowance: condition.otherFixedAllowance,
    };
}

export function fixedWageTotalFromForm(form: SalaryConditionFormValue): number {
    return sumFixedWageFields({
        basicSalary: toNonNegativeNumber(form.basicSalary),
        commutingAllowance: toNonNegativeNumber(form.commutingAllowance),
        positionAllowance: toNonNegativeNumber(form.positionAllowance),
        housingAllowance: toNonNegativeNumber(form.housingAllowance),
        fixedOvertimePay: toNonNegativeNumber(form.fixedOvertimePay),
        otherFixedAllowance: toNonNegativeNumber(form.otherFixedAllowance),
    });
}

export function salaryConditionInputFromForm(
    form: SalaryConditionFormValue,
    params: { companyId: string; employeeId: string },
): SalaryConditionInput {
    const fixed = {
        basicSalary: toNonNegativeNumber(form.basicSalary),
        commutingAllowance: toNonNegativeNumber(form.commutingAllowance),
        positionAllowance: toNonNegativeNumber(form.positionAllowance),
        housingAllowance: toNonNegativeNumber(form.housingAllowance),
        fixedOvertimePay: toNonNegativeNumber(form.fixedOvertimePay),
        otherFixedAllowance: toNonNegativeNumber(form.otherFixedAllowance),
    };

    return {
        companyId: params.companyId,
        employeeId: params.employeeId,
        effectiveStartMonth: form.effectiveStartMonth.trim(),
        ...fixed,
        note: form.note.trim(),
        changeReason: form.changeReason.trim(),
    };
}

export function formValueFromSalaryCondition(condition: SalaryCondition): SalaryConditionFormValue {
    return {
        effectiveStartMonth: condition.effectiveStartMonth,
        basicSalary: condition.basicSalary,
        commutingAllowance: condition.commutingAllowance,
        positionAllowance: condition.positionAllowance,
        housingAllowance: condition.housingAllowance,
        fixedOvertimePay: condition.fixedOvertimePay,
        otherFixedAllowance: condition.otherFixedAllowance,
        note: condition.note,
        changeReason: condition.changeReason,
    };
}

/** 対象月に適用する給与条件（開始月が最も新しいもの） */
export function resolveSalaryConditionForMonth(
    conditions: SalaryCondition[],
    targetYearMonth: string,
): SalaryCondition | null {
    const applicable = conditions
        .filter((condition) => condition.effectiveStartMonth <= targetYearMonth)
        .sort((a, b) => (a.effectiveStartMonth < b.effectiveStartMonth ? 1 : -1));

    return applicable[0] ?? null;
}

export function resolvePreviousSalaryCondition(
    conditions: SalaryCondition[],
    effectiveStartMonth: string,
): SalaryCondition | null {
    return conditions
        .filter((condition) => condition.effectiveStartMonth < effectiveStartMonth)
        .sort((a, b) => (a.effectiveStartMonth < b.effectiveStartMonth ? 1 : -1))[0] ?? null;
}

export function buildSalaryConditionPeriods(conditions: SalaryCondition[]): SalaryConditionPeriod[] {
    const sorted = [...conditions].sort(
        (a, b) => (a.effectiveStartMonth < b.effectiveStartMonth ? -1 : 1),
    );

    return sorted.map((condition, index) => {
        const next = sorted[index + 1];
        const displayEndMonth = next
            ? addMonthsToYearMonth(next.effectiveStartMonth, -1)
            : null;
        const startLabel = formatYearMonthLabel(condition.effectiveStartMonth);
        const displayLabel = displayEndMonth
            ? `${startLabel}〜${formatYearMonthLabel(displayEndMonth)}`
            : `${startLabel}〜現在`;

        return {
            condition,
            displayEndMonth,
            displayLabel,
        };
    });
}

export function resolveEarliestSalaryConditionMonth(params: {
    joinedDate: string | null | undefined;
    qualificationDate?: string | null;
}): string | null {
    const joinYm = yearMonthFromDateString(params.joinedDate);
    const qualificationYm = yearMonthFromDateString(params.qualificationDate);
    if (joinYm && qualificationYm) {
        return joinYm > qualificationYm ? joinYm : qualificationYm;
    }
    return joinYm ?? qualificationYm ?? null;
}

export function validateSalaryConditionForm(params: {
    form: SalaryConditionFormValue;
    employee: Employee;
    conditions: SalaryCondition[];
    confirmedRewardMonths: string[];
    editingEffectiveStartMonth?: string | null;
    qualificationDate?: string | null;
}): string | null {
    const effectiveStartMonth = params.form.effectiveStartMonth.trim();
    if (!/^\d{4}-\d{2}$/.test(effectiveStartMonth)) {
        return '適用開始月を選択してください。';
    }

    const earliest = resolveEarliestSalaryConditionMonth({
        joinedDate: params.employee.joinedDate,
        qualificationDate: params.qualificationDate,
    });
    if (earliest && effectiveStartMonth < earliest) {
        return `適用開始月は${formatYearMonthLabel(earliest)}以降を指定してください。`;
    }

    for (const key of FIXED_WAGE_FIELD_KEYS) {
        const value = params.form[key];
        if (value === '' || value === null || value === undefined) {
            return `${fieldLabel(key)}を入力してください（該当なしは0）。`;
        }
        if (toNonNegativeNumber(value) < 0) {
            return `${fieldLabel(key)}は0円以上で入力してください。`;
        }
    }

    if (fixedWageTotalFromForm(params.form) <= 0) {
        return '固定的賃金合計は1円以上にしてください。';
    }

    const duplicate = params.conditions.find(
        (condition) =>
            condition.effectiveStartMonth === effectiveStartMonth
            && condition.effectiveStartMonth !== params.editingEffectiveStartMonth,
    );
    if (duplicate) {
        return `${formatYearMonthLabel(effectiveStartMonth)}開始の給与条件は既に登録されています。`;
    }

    const latestConfirmed = maxYearMonth(params.confirmedRewardMonths);
    const isEdit = params.editingEffectiveStartMonth === effectiveStartMonth;
    if (latestConfirmed && effectiveStartMonth <= latestConfirmed && !isEdit) {
        return `${formatYearMonthLabel(latestConfirmed)}まで確定済みの報酬があるため、この適用開始月では新規登録できません。`;
    }

    return null;
}

export function shouldTriggerRevisionFromSalaryCondition(
    current: SalaryConditionInput,
    previous: SalaryCondition | null,
): boolean {
    if (!previous) return false;
    const currentTotal = sumFixedWageFields(current);
    return currentTotal !== previous.fixedWageTotal;
}

export function salaryConditionRevisionOriginMonths(conditions: SalaryCondition[]): string[] {
    return conditions
        .filter((condition) => condition.triggersRevision)
        .map((condition) => condition.effectiveStartMonth)
        .sort();
}

export function mergeFixedWageChangedMonths(
    rewardMonths: string[],
    conditionMonths: string[],
): string[] {
    return [...new Set([...rewardMonths, ...conditionMonths])].sort();
}

export function applySalaryConditionToRewardDraft(
    reward: StandardMonthlyReward | null,
    condition: SalaryCondition,
    targetYearMonth: string,
    companyId: string,
    employeeId: string,
    triggersRevision: boolean,
): StandardMonthlyReward {
    const fixed = fixedWageFieldsFromSalaryCondition(condition);
    const variableDefaults = {
        overtimePay: reward?.overtimePay ?? 0,
        holidayPay: reward?.holidayPay ?? 0,
        nightPay: reward?.nightPay ?? 0,
        commissionPay: reward?.commissionPay ?? 0,
        otherVariablePay: reward?.otherVariablePay ?? 0,
    };

    return {
        id: reward?.id ?? `${employeeId}_${targetYearMonth}`,
        companyId,
        employeeId,
        targetYearMonth,
        ...fixed,
        ...variableDefaults,
        monthlyReward: undefined,
        fixedWageChanged: triggersRevision && targetYearMonth === condition.effectiveStartMonth
            ? true
            : reward?.fixedWageChanged ?? false,
        changedFixedWageFields: reward?.changedFixedWageFields,
        status: reward?.status ?? 'draft',
        healthInsuranceGrade: reward?.healthInsuranceGrade ?? 0,
        healthInsuranceStandardMonthlyAmount: reward?.healthInsuranceStandardMonthlyAmount ?? 0,
        pensionInsuranceGrade: reward?.pensionInsuranceGrade ?? 0,
        pensionInsuranceStandardMonthlyAmount: reward?.pensionInsuranceStandardMonthlyAmount ?? 0,
        createdAt: reward?.createdAt ?? ({} as StandardMonthlyReward['createdAt']),
        updatedAt: reward?.updatedAt ?? ({} as StandardMonthlyReward['updatedAt']),
    };
}

export function isConfirmedRewardStatus(status: StandardMonthlyRewardStatus | undefined): boolean {
    return status === 'confirmed';
}

function fieldLabel(key: keyof SalaryConditionFormValue): string {
    const labels: Record<string, string> = {
        basicSalary: '基本給',
        commutingAllowance: '通勤手当',
        positionAllowance: '役職手当',
        housingAllowance: '住宅手当',
        fixedOvertimePay: '見込み残業代',
        otherFixedAllowance: 'その他固定手当',
    };
    return labels[key] ?? key;
}

function toNonNegativeNumber(value: number | ''): number {
    if (value === '' || value === null || value === undefined) return 0;
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : 0;
}

function maxYearMonth(yearMonths: string[]): string | null {
    if (yearMonths.length === 0) return null;
    return yearMonths.reduce((max, ym) => (ym > max ? ym : max), yearMonths[0]!);
}
