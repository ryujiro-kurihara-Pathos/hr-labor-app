import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { StandardMonthlyReward } from '../../insurance/models/standard-monthly-reward.model';
import { effectiveMonthlyRewardTotal } from '../../insurance/utils/effective-monthly-reward.util';
import { yearMonthFromDateString } from '../../insurance/utils/reward-target-month.util';

export type QualificationMonthlyReward = {
    targetYearMonth: string;
    cashAmount: number;
    inKindAmount: number;
    totalAmount: number;
    isMidMonthJoin: boolean;
};

/** 入社月の報酬月額（途中入社でも1か月分として扱う） */
export function resolveQualificationMonthlyReward(
    joinedDate: string,
    reward: StandardMonthlyReward | null,
    allBonuses: BonusReward[] = [],
): QualificationMonthlyReward | null {
    const targetYearMonth = yearMonthFromDateString(joinedDate);
    if (!targetYearMonth || !reward) return null;

    const totalAmount = effectiveMonthlyRewardTotal(reward, targetYearMonth, allBonuses);
    if (totalAmount <= 0) return null;

    const day = Number(joinedDate.split('-')[2]);
    const isMidMonthJoin = Number.isFinite(day) && day > 1;

    return {
        targetYearMonth,
        cashAmount: totalAmount,
        inKindAmount: 0,
        totalAmount,
        isMidMonthJoin,
    };
}

export function formatYen(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '—';
    return `${amount.toLocaleString()} 円`;
}
