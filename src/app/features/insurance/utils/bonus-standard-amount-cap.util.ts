import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { isBonusConfirmed } from '../../bonus/utils/bonus-status.util';
import { shouldTreatBonusAsMonthlyRemuneration } from './effective-monthly-reward.util';

/** 健康保険・介護保険の標準賞与額 年度累計上限（4月1日〜翌年3月31日） */
export const HEALTH_CARE_BONUS_STANDARD_AMOUNT_ANNUAL_CAP = 5_730_000;

/** 厚生年金の標準賞与額 月あたり上限（同月複数回は合算） */
export const PENSION_BONUS_STANDARD_AMOUNT_MONTHLY_CAP = 1_500_000;

export type BonusPremiumableStandardAmounts = {
    healthAndCare: number;
    pension: number;
    healthAndCarePerBonus: ReadonlyMap<string, number>;
};

/** 健康保険の年度（4月始まり）の開始年 */
export function healthInsuranceFiscalYearStartYear(yearMonth: string): number {
    const [y, m] = yearMonth.split('-').map(Number);
    return m < 4 ? y - 1 : y;
}

function compareBonusChronologically(a: BonusReward, b: BonusReward): number {
    const yearMonthOrder = a.targetYearMonth.localeCompare(b.targetYearMonth);
    if (yearMonthOrder !== 0) return yearMonthOrder;
    return a.paymentDate.localeCompare(b.paymentDate);
}

function isPremiumableBonus(bonus: BonusReward, allBonuses: BonusReward[]): boolean {
    if (!isBonusConfirmed(bonus)) return false;
    return !shouldTreatBonusAsMonthlyRemuneration(allBonuses, bonus.targetYearMonth);
}

function premiumableFiscalYearBonuses(
    allBonuses: BonusReward[],
    fiscalYearStart: number,
): BonusReward[] {
    return allBonuses
        .filter((bonus) => {
            if (!isPremiumableBonus(bonus, allBonuses)) return false;
            return healthInsuranceFiscalYearStartYear(bonus.targetYearMonth) === fiscalYearStart;
        })
        .sort(compareBonusChronologically);
}

function cumulativeHealthCarePremiumableUsed(bonuses: BonusReward[]): number {
    let used = 0;
    for (const bonus of bonuses) {
        const amount = Math.max(0, bonus.standardBonusAmount);
        const allocatable = Math.min(
            amount,
            Math.max(0, HEALTH_CARE_BONUS_STANDARD_AMOUNT_ANNUAL_CAP - used),
        );
        used += allocatable;
    }
    return used;
}

function allocateHealthCarePremiumable(
    bonuses: BonusReward[],
    startingUsed: number,
): { total: number; perBonus: Map<string, number> } {
    let used = startingUsed;
    let total = 0;
    const perBonus = new Map<string, number>();

    for (const bonus of bonuses) {
        const amount = Math.max(0, bonus.standardBonusAmount);
        const allocatable = Math.min(
            amount,
            Math.max(0, HEALTH_CARE_BONUS_STANDARD_AMOUNT_ANNUAL_CAP - used),
        );
        perBonus.set(bonus.id, allocatable);
        total += allocatable;
        used += allocatable;
    }

    return { total, perBonus };
}

/**
 * 賞与保険料の算定に使う標準賞与額（上限適用後）を返す。
 * - 健康保険・介護保険: 年度累計 573万円まで（支給年月順）
 * - 厚生年金: 同月合算で 150万円まで
 */
export function resolveBonusPremiumableStandardAmounts(params: {
    liabilityYearMonth: string;
    monthBonuses: BonusReward[];
    allBonuses: BonusReward[];
}): BonusPremiumableStandardAmounts {
    const { liabilityYearMonth, monthBonuses, allBonuses } = params;
    const sortedMonthBonuses = [...monthBonuses]
        .filter((bonus) => isPremiumableBonus(bonus, allBonuses))
        .sort(compareBonusChronologically);

    const monthStandardTotal = sortedMonthBonuses.reduce(
        (sum, bonus) => sum + Math.max(0, bonus.standardBonusAmount),
        0,
    );
    const pension = Math.min(monthStandardTotal, PENSION_BONUS_STANDARD_AMOUNT_MONTHLY_CAP);

    const fiscalYearStart = healthInsuranceFiscalYearStartYear(liabilityYearMonth);
    const fiscalBonuses = premiumableFiscalYearBonuses(allBonuses, fiscalYearStart);
    const priorBonuses = fiscalBonuses.filter(
        (bonus) => bonus.targetYearMonth < liabilityYearMonth,
    );
    const priorUsed = cumulativeHealthCarePremiumableUsed(priorBonuses);
    const { total: healthAndCare, perBonus: healthAndCarePerBonus } = allocateHealthCarePremiumable(
        sortedMonthBonuses,
        priorUsed,
    );

    return { healthAndCare, pension, healthAndCarePerBonus };
}
