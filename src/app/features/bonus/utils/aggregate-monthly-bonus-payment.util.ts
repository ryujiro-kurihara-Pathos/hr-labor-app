import { BonusReward } from '../models/bonus-reward.model';
import { confirmedBonuses } from './bonus-status.util';

export const MONTHLY_BONUS_PAYMENT_AGGREGATED_REMARK = '同一月内の賞与合算';

export type AggregatedMonthlyBonusPayment = {
    targetYearMonth: string;
    /** 賞与支払年月日（その月の最後の支給日） */
    paymentDate: string;
    /** 初回支払日（その月の最初の支給日） */
    firstPaymentDate: string;
    /** 賞与支払額（同月合計） */
    bonusAmountTotal: number;
    /** 標準賞与額（賞与支払額合計の1,000円未満切捨て） */
    standardBonusAmount: number;
    /** 備考（複数件合算時のみ） */
    remark: string;
    /** 同月に2件以上あるか */
    isAggregated: boolean;
    bonuses: BonusReward[];
};

export function calculateAggregatedStandardBonusAmount(bonusAmountTotal: number): number {
    return Math.floor(Math.max(0, bonusAmountTotal) / 1000) * 1000;
}

/** 同一従業員・同一月の賞与を届出用に1行分へ合算する */
export function aggregateMonthlyBonusPayment(
    bonuses: BonusReward[],
    targetYearMonth: string,
): AggregatedMonthlyBonusPayment | null {
    const inMonth = bonuses
        .filter((bonus) => bonus.targetYearMonth === targetYearMonth)
        .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
    if (inMonth.length === 0) return null;

    const firstPaymentDate = inMonth[0]!.paymentDate;
    const paymentDate = inMonth[inMonth.length - 1]!.paymentDate;
    const bonusAmountTotal = inMonth.reduce((sum, bonus) => sum + bonus.bonusAmount, 0);
    const isAggregated = inMonth.length > 1;

    return {
        targetYearMonth,
        paymentDate,
        firstPaymentDate,
        bonusAmountTotal,
        standardBonusAmount: calculateAggregatedStandardBonusAmount(bonusAmountTotal),
        remark: isAggregated ? MONTHLY_BONUS_PAYMENT_AGGREGATED_REMARK : '',
        isAggregated,
        bonuses: inMonth,
    };
}

export function aggregateConfirmedMonthlyBonusPayment(
    bonuses: BonusReward[],
    targetYearMonth: string,
): AggregatedMonthlyBonusPayment | null {
    return aggregateMonthlyBonusPayment(confirmedBonuses(bonuses), targetYearMonth);
}
