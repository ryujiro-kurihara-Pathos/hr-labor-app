import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { monthlyRewardTotal } from './revision-determination.util';

/** 年4回以上支給される賞与を月次報酬に算入する閾値 */
export const MONTHLY_REMUNERATION_BONUS_MIN_PAYMENTS_PER_YEAR = 4;

export function calendarYearFromYearMonth(yearMonth: string): number {
    return Number(yearMonth.split('-')[0]);
}

/** 賞与算入の対象期間（暦年） */
export function getBonusRemunerationTargetYear(referenceYearMonth: string): number {
    return calendarYearFromYearMonth(referenceYearMonth);
}

/** 対象期間（暦年）における賞与支給回数 */
export function countBonusPaymentsInTargetPeriod(
    bonuses: BonusReward[],
    referenceYearMonth: string,
): number {
    const year = getBonusRemunerationTargetYear(referenceYearMonth);
    return countBonusPaymentsInCalendarYear(bonuses, year);
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
 * 対象期間内で4回目以降の賞与支給がある場合、賞与を報酬月額に算入する。
 * 支給額の一定性は判定しない。
 */
export function shouldTreatBonusAsMonthlyRemuneration(
    bonuses: BonusReward[],
    referenceYearMonth: string,
): boolean {
    return (
        countBonusPaymentsInTargetPeriod(bonuses, referenceYearMonth) >=
        MONTHLY_REMUNERATION_BONUS_MIN_PAYMENTS_PER_YEAR
    );
}

/** 対象期間内の賞与支給額の合計 */
export function sumBonusAmountInTargetPeriod(
    bonuses: BonusReward[],
    referenceYearMonth: string,
): number {
    const year = getBonusRemunerationTargetYear(referenceYearMonth);
    return bonuses
        .filter((bonus) => calendarYearFromYearMonth(bonus.targetYearMonth) === year)
        .reduce((sum, bonus) => sum + bonus.bonusAmount, 0);
}

/**
 * 標準報酬月額の算定に加える賞与分（対象期間内の賞与合計 ÷ 12）。
 * 4回未満の場合は 0。
 */
export function monthlyBonusRemunerationAddition(
    bonuses: BonusReward[],
    referenceYearMonth: string,
): number {
    if (!shouldTreatBonusAsMonthlyRemuneration(bonuses, referenceYearMonth)) {
        return 0;
    }
    const total = sumBonusAmountInTargetPeriod(bonuses, referenceYearMonth);
    return Math.round(total / 12);
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
    return base + monthlyBonusRemunerationAddition(allBonuses, yearMonth);
}

/** 報酬月額（数値）に、算入対象の賞与を加えた報酬月額 */
export function effectiveMonthlyRewardFromBase(
    baseMonthlyReward: number,
    yearMonth: string,
    allBonuses: BonusReward[],
): number {
    return baseMonthlyReward + monthlyBonusRemunerationAddition(allBonuses, yearMonth);
}

/** 標準賞与額・賞与保険料・賞与支払届の対象となる賞与（年4回以上の場合は空） */
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
