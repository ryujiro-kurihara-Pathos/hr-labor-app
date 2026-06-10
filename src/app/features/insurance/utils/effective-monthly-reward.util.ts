import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { monthlyRewardTotal } from './revision-determination.util';

/** 年4回以上支給される賞与を月次報酬に算入する閾値 */
export const MONTHLY_REMUNERATION_BONUS_MIN_PAYMENTS_PER_YEAR = 4;

export function calendarYearFromYearMonth(yearMonth: string): number {
    return Number(yearMonth.split('-')[0]);
}

/** 暦年における賞与支給回数 */
export function countBonusPaymentsInCalendarYear(
    bonuses: BonusReward[],
    year: number,
): number {
    return bonuses.filter(
        (bonus) => calendarYearFromYearMonth(bonus.targetYearMonth) === year,
    ).length;
}

/**
 * 対象月の暦年で賞与が年4回以上支給される場合、賞与を報酬月額に算入する。
 * 支給額の一定性は判定しない。
 */
export function shouldTreatBonusAsMonthlyRemuneration(
    bonuses: BonusReward[],
    referenceYearMonth: string,
): boolean {
    const year = calendarYearFromYearMonth(referenceYearMonth);
    return (
        countBonusPaymentsInCalendarYear(bonuses, year) >=
        MONTHLY_REMUNERATION_BONUS_MIN_PAYMENTS_PER_YEAR
    );
}

/** 対象年月に支給された賞与額の合計 */
export function sumBonusAmountInMonth(
    bonuses: BonusReward[],
    yearMonth: string,
): number {
    return bonuses
        .filter((bonus) => bonus.targetYearMonth === yearMonth)
        .reduce((sum, bonus) => sum + bonus.bonusAmount, 0);
}

/** 月次報酬に、算入対象の賞与を加えた報酬月額 */
export function effectiveMonthlyRewardTotal(
    reward: StandardMonthlyReward,
    yearMonth: string,
    allBonuses: BonusReward[],
): number {
    const base = monthlyRewardTotal(reward);
    if (!shouldTreatBonusAsMonthlyRemuneration(allBonuses, yearMonth)) {
        return base;
    }
    return base + sumBonusAmountInMonth(allBonuses, yearMonth);
}

/** 報酬月額（数値）に、算入対象の賞与を加えた報酬月額 */
export function effectiveMonthlyRewardFromBase(
    baseMonthlyReward: number,
    yearMonth: string,
    allBonuses: BonusReward[],
): number {
    if (!shouldTreatBonusAsMonthlyRemuneration(allBonuses, yearMonth)) {
        return baseMonthlyReward;
    }
    return baseMonthlyReward + sumBonusAmountInMonth(allBonuses, yearMonth);
}

/** 標準賞与額・賞与保険料の対象となる賞与（年4回以上の場合は空） */
export function bonusesForStandardBonusPremium(
    monthBonuses: BonusReward[],
    yearMonth: string,
    allBonuses: BonusReward[],
): BonusReward[] {
    if (shouldTreatBonusAsMonthlyRemuneration(allBonuses, yearMonth)) {
        return [];
    }
    return monthBonuses;
}
