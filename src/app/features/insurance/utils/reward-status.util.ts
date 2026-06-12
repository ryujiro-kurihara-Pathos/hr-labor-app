import {
    StandardMonthlyReward,
    StandardMonthlyRewardStatus,
} from '../models/standard-monthly-reward.model';

/** 既存データ（status 未設定）は確定として扱う */
export function normalizeRewardStatus(
    reward: StandardMonthlyReward | null | undefined,
): StandardMonthlyRewardStatus {
    if (!reward) return 'default';
    if (!reward.status) return 'confirmed';
    return reward.status;
}

export function isRewardConfirmed(reward: StandardMonthlyReward | null | undefined): boolean {
    return normalizeRewardStatus(reward) === 'confirmed';
}

export function isRewardDraft(reward: StandardMonthlyReward | null | undefined): boolean {
    return normalizeRewardStatus(reward) === 'draft';
}

/** 算定・一覧の「登録済み」判定に使う確定済み報酬のみ */
export function confirmedRewardsByYearMonth(
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
): Record<string, StandardMonthlyReward> {
    const result: Record<string, StandardMonthlyReward> = {};
    for (const [ym, reward] of Object.entries(rewardsByYearMonth)) {
        if (isRewardConfirmed(reward)) {
            result[ym] = reward;
        }
    }
    return result;
}
