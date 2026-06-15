import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { StandardMonthlyReward } from '../../insurance/models/standard-monthly-reward.model';
import { effectiveMonthlyRewardTotal } from '../../insurance/utils/effective-monthly-reward.util';
import { shouldProrateMonthlyRewardByPaymentBaseDays } from '../../insurance/utils/monthly-reward-proration.util';
import { yearMonthFromDateString } from '../../insurance/utils/reward-target-month.util';
import { EmploymentType } from '../../employee/models/employee.models';

export type QualificationMonthlyReward = {
    targetYearMonth: string;
    cashAmount: number;
    inKindAmount: number;
    totalAmount: number;
    isMidMonthJoin: boolean;
    /** パート・アルバイトは入力した報酬月額をそのまま使用 */
    usesDirectMonthlyRewardEntry: boolean;
};

/** 入社月の報酬月額 */
export function resolveQualificationMonthlyReward(
    joinedDate: string,
    reward: StandardMonthlyReward | null,
    allBonuses: BonusReward[] = [],
    employmentType: EmploymentType = null,
): QualificationMonthlyReward | null {
    const targetYearMonth = yearMonthFromDateString(joinedDate);
    if (!targetYearMonth || !reward) return null;

    const totalAmount = effectiveMonthlyRewardTotal(reward, targetYearMonth, allBonuses);
    if (totalAmount <= 0) return null;

    const day = Number(joinedDate.split('-')[2]);
    const isMidMonthJoin =
        shouldProrateMonthlyRewardByPaymentBaseDays(employmentType) &&
        Number.isFinite(day) &&
        day > 1;
    const usesDirectMonthlyRewardEntry = !shouldProrateMonthlyRewardByPaymentBaseDays(employmentType);

    return {
        targetYearMonth,
        cashAmount: totalAmount,
        inKindAmount: 0,
        totalAmount,
        isMidMonthJoin,
        usesDirectMonthlyRewardEntry,
    };
}

export function formatYen(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '—';
    return `${amount.toLocaleString()} 円`;
}
