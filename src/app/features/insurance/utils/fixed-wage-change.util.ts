import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';

export const FIXED_WAGE_FIELD_KEYS = [
    'basicSalary',
    'commutingAllowance',
    'positionAllowance',
    'housingAllowance',
    'fixedOvertimePay',
    'otherFixedAllowance',
] as const;

export type FixedWageFieldKey = (typeof FIXED_WAGE_FIELD_KEYS)[number];

export const FIXED_WAGE_FIELD_LABELS: Record<FixedWageFieldKey, string> = {
    basicSalary: '基本給',
    commutingAllowance: '通勤手当',
    positionAllowance: '役職手当',
    housingAllowance: '住宅手当',
    fixedOvertimePay: '見込み残業代',
    otherFixedAllowance: 'その他固定手当',
};

export function detectFixedWageChanges(
    current: Pick<StandardMonthlyReward, FixedWageFieldKey>,
    previous: Pick<StandardMonthlyReward, FixedWageFieldKey> | null,
): { fixedWageChanged: boolean; changedFixedWageFields: FixedWageFieldKey[] } {
    if (!previous) {
        return { fixedWageChanged: false, changedFixedWageFields: [] };
    }

    const changedFixedWageFields = FIXED_WAGE_FIELD_KEYS.filter(
        (key) => current[key] !== previous[key],
    );
    const totalChanged = sumFixedWageFields(current) !== sumFixedWageFields(previous);

    return {
        fixedWageChanged: totalChanged,
        changedFixedWageFields: totalChanged ? changedFixedWageFields : [],
    };
}

export function sumFixedWageFields(
    reward: Pick<StandardMonthlyReward, FixedWageFieldKey>,
): number {
    return FIXED_WAGE_FIELD_KEYS.reduce((sum, key) => sum + reward[key], 0);
}
