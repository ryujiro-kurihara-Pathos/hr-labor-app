import { StandardMonthlyRewardCalculation } from '../services/standard-monthly-reward-calculator.service';

export type MonthlyPremiumStandardAmounts = {
    health: number | null;
    pension: number | null;
    care: number | null;
};

/**
 * 月次保険料算定に使う標準報酬月額。
 * 健保・介護は協会けんぽ表、厚生年金は年金表（上限等級32・650,000円）の値を使う。
 */
export function resolveMonthlyPremiumStandardAmounts(
    calculation: StandardMonthlyRewardCalculation | null | undefined,
): MonthlyPremiumStandardAmounts {
    if (!calculation?.health) {
        return { health: null, pension: null, care: null };
    }

    const healthStandard = calculation.health.standardMonthlyAmount;
    return {
        health: healthStandard,
        pension: calculation.pension?.standardMonthlyAmount ?? null,
        care: healthStandard,
    };
}
