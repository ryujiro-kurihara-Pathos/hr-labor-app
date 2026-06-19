export const DEPENDENT_ANNUAL_INCOME_LIMIT_STANDARD = 1_300_000;
export const DEPENDENT_ANNUAL_INCOME_LIMIT_YOUNG_ADULT = 1_500_000;
export const DEPENDENT_ANNUAL_INCOME_LIMIT_SENIOR_OR_DISABLED = 1_800_000;

export type DependentIncomeLimitCategory = 'standard' | 'young_adult' | 'senior_or_disabled';

export type DependentIncomeLimit = {
    limit: number;
    category: DependentIncomeLimitCategory;
    label: string;
};

export type DependentIncomeEligibilityResult = {
    eligible: boolean;
    limit: DependentIncomeLimit;
    reason: string | null;
};

const LIMIT_LABELS: Record<DependentIncomeLimitCategory, string> = {
    standard: '通常',
    young_adult: '19歳以上23歳未満',
    senior_or_disabled: '60歳以上または障害者',
};

export function ageAtReferenceDate(birthDate: string, referenceDate: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
        return null;
    }

    const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
    const [refYear, refMonth, refDay] = referenceDate.split('-').map(Number);
    let age = refYear - birthYear;
    if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
        age -= 1;
    }
    return age;
}

export function resolveDependentIncomeLimit(params: {
    birthDate: string;
    referenceDate: string;
    isDisabled: boolean;
}): DependentIncomeLimit {
    const age = ageAtReferenceDate(params.birthDate, params.referenceDate);

    if (params.isDisabled || (age !== null && age >= 60)) {
        return {
            limit: DEPENDENT_ANNUAL_INCOME_LIMIT_SENIOR_OR_DISABLED,
            category: 'senior_or_disabled',
            label: LIMIT_LABELS.senior_or_disabled,
        };
    }

    if (age !== null && age >= 19 && age < 23) {
        return {
            limit: DEPENDENT_ANNUAL_INCOME_LIMIT_YOUNG_ADULT,
            category: 'young_adult',
            label: LIMIT_LABELS.young_adult,
        };
    }

    return {
        limit: DEPENDENT_ANNUAL_INCOME_LIMIT_STANDARD,
        category: 'standard',
        label: LIMIT_LABELS.standard,
    };
}

export function evaluateDependentIncomeEligibility(params: {
    annualIncome: number | null | undefined;
    birthDate: string;
    referenceDate: string;
    isDisabled: boolean;
}): DependentIncomeEligibilityResult {
    const limit = resolveDependentIncomeLimit(params);

    if (params.annualIncome === null || params.annualIncome === undefined) {
        return { eligible: true, limit, reason: null };
    }

    const income = Number(params.annualIncome);
    if (!Number.isFinite(income) || income < limit.limit) {
        return { eligible: true, limit, reason: null };
    }

    return {
        eligible: false,
        limit,
        reason: `年間収入が${formatYen(limit.limit)}以上のため扶養対象外です（${limit.label}）。`,
    };
}

/** 扶養追加届を作成できない場合の理由。作成可能なら null */
export function dependentAddIncomeBlockReason(params: {
    annualIncome: number | null | undefined;
    birthDate: string;
    referenceDate: string;
    isDisabled: boolean;
}): string | null {
    const result = evaluateDependentIncomeEligibility(params);
    if (result.eligible) return null;
    return `${result.reason ?? '扶養対象外です。'}扶養追加届は作成できません。`;
}

export function formatYen(amount: number): string {
    return `${amount.toLocaleString('ja-JP')}円`;
}

export function resolveDependentIncomeReferenceDate(params: {
    changeType: 'add' | 'change' | 'delete';
    dependencyStartDate: string;
    changeDate: string;
    dependencyEndDate: string;
    fallbackDate: string;
}): string {
    if (params.changeType === 'add') {
        return params.dependencyStartDate || params.fallbackDate;
    }
    if (params.changeType === 'delete') {
        return params.dependencyEndDate || params.fallbackDate;
    }
    return params.changeDate || params.dependencyStartDate || params.fallbackDate;
}

export const DEPENDENT_ANNUAL_INCOME_RULE_LINES = [
    '通常：130万円未満',
    '19歳以上23歳未満：150万円未満',
    '60歳以上または障害者：180万円未満',
    '基準額以上の場合は扶養対象外となり、扶養追加届は作成できません。',
] as const;
