import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';

export const FIXED_WAGE_FIELD_KEYS = [
    'basicSalary',
    'commutingAllowance',
    'monthlyAllowance',
    'positionAllowance',
    'housingAllowance',
    'fixedOvertimePay',
] as const;

export type FixedWageFieldKey = (typeof FIXED_WAGE_FIELD_KEYS)[number];

export const FIXED_WAGE_FIELD_LABELS: Record<FixedWageFieldKey, string> = {
    basicSalary: '基本給',
    commutingAllowance: '通勤手当',
    monthlyAllowance: '毎月支給される手当',
    positionAllowance: '役職手当',
    housingAllowance: '住宅手当',
    fixedOvertimePay: '見込み残業代',
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

    return {
        fixedWageChanged: changedFixedWageFields.length > 0,
        changedFixedWageFields: [...changedFixedWageFields],
    };
}
