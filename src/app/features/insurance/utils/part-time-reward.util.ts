import { SalaryCondition, SalaryConditionFormValue } from '../models/salary-condition.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';

export const PART_TIME_SALARY_CONDITION_FIELD_KEYS = [
    'basicSalary',
    'commutingAllowance',
    'otherFixedAllowance',
] as const;

export type PartTimeSalaryConditionFieldKey = (typeof PART_TIME_SALARY_CONDITION_FIELD_KEYS)[number];

export const PART_TIME_SALARY_CONDITION_FIELD_LABELS: Record<PartTimeSalaryConditionFieldKey, string> = {
    basicSalary: '月額報酬',
    commutingAllowance: '通勤手当',
    otherFixedAllowance: 'その他手当',
};

export const PART_TIME_SALARY_CONDITION_TOTAL_LABEL = '見込み給料';

/** 給与条件保存時にパート向け項目以外を0にそろえる */
export function normalizePartTimeSalaryConditionForm(
    form: SalaryConditionFormValue,
): SalaryConditionFormValue {
    return {
        ...form,
        positionAllowance: 0,
        housingAllowance: 0,
        fixedOvertimePay: 0,
    };
}

export function partTimeSalaryConditionTotal(
    condition: Pick<SalaryCondition, PartTimeSalaryConditionFieldKey>,
): number {
    return partTimeMonthlyRewardTotal(
        condition.basicSalary,
        condition.commutingAllowance,
        condition.otherFixedAllowance,
    );
}

export function partTimeSalaryConditionTotalFromForm(
    form: Pick<SalaryConditionFormValue, PartTimeSalaryConditionFieldKey>,
): number {
    return partTimeMonthlyRewardTotal(
        toNonNegativeNumber(form.basicSalary),
        toNonNegativeNumber(form.commutingAllowance),
        toNonNegativeNumber(form.otherFixedAllowance),
    );
}

export function arePartTimeSalaryConditionFieldsEqual(
    a: SalaryConditionFormValue | Pick<SalaryCondition, PartTimeSalaryConditionFieldKey>,
    b: SalaryConditionFormValue | Pick<SalaryCondition, PartTimeSalaryConditionFieldKey>,
): boolean {
    return PART_TIME_SALARY_CONDITION_FIELD_KEYS.every(
        (key) => partTimeSalaryConditionFieldValue(a, key) === partTimeSalaryConditionFieldValue(b, key),
    );
}

function partTimeSalaryConditionFieldValue(
    source: SalaryConditionFormValue | Pick<SalaryCondition, PartTimeSalaryConditionFieldKey>,
    key: PartTimeSalaryConditionFieldKey,
): number {
    return toNonNegativeNumber(source[key] as number | '');
}

function toNonNegativeNumber(value: number | ''): number {
    if (value === '' || value === null || value === undefined) return 0;
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : 0;
}

/** パート向けフォームの「その他手当」表示用（変動賃金を含めて集約） */
export function partTimeOtherAllowanceTotal(
    reward: Pick<
        StandardMonthlyReward,
        | 'otherFixedAllowance'
        | 'overtimePay'
        | 'holidayPay'
        | 'nightPay'
        | 'commissionPay'
        | 'otherVariablePay'
    >,
): number {
    return (
        reward.otherFixedAllowance +
        reward.overtimePay +
        reward.holidayPay +
        reward.nightPay +
        reward.commissionPay +
        reward.otherVariablePay
    );
}

/** パートの報酬月額（月額報酬＋通勤手当＋その他手当） */
export function partTimeMonthlyRewardTotal(
    basicSalary: number,
    commutingAllowance: number,
    otherAllowance: number,
): number {
    return basicSalary + commutingAllowance + otherAllowance;
}

/** 保存済みレコードからパートの報酬月額を取得 */
export function partTimeInsuranceMonthlyRewardFromRecord(reward: StandardMonthlyReward): number {
    if (reward.monthlyReward != null && reward.monthlyReward >= 0) {
        return reward.monthlyReward;
    }
    return partTimeMonthlyRewardTotal(
        reward.basicSalary,
        reward.commutingAllowance,
        partTimeOtherAllowanceTotal(reward),
    );
}
