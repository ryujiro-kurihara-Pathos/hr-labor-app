import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { isRewardConfirmed } from './reward-status.util';

/** 対象年月より前で、最も新しい確定済み月次報酬を返す */
export function findLatestRegisteredRewardBefore(
    targetYearMonth: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
): StandardMonthlyReward | null {
    let latestYm: string | null = null;
    let latest: StandardMonthlyReward | null = null;

    for (const [ym, reward] of Object.entries(rewardsByYearMonth)) {
        if (ym >= targetYearMonth) continue;
        if (!isRewardConfirmed(reward)) continue;
        if (!latestYm || ym > latestYm) {
            latestYm = ym;
            latest = reward;
        }
    }

    return latest;
}

/** 確定済み月次報酬のうち、最も新しい勤務月（targetYearMonth）を返す */
export function findLatestConfirmedWorkYearMonth(
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
): string | null {
    let latestYm: string | null = null;

    for (const [ym, reward] of Object.entries(rewardsByYearMonth)) {
        if (!isRewardConfirmed(reward)) continue;
        if (!latestYm || ym > latestYm) {
            latestYm = ym;
        }
    }

    return latestYm;
}
