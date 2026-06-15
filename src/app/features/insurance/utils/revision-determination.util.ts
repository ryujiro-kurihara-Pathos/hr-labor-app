import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { GradeLookupResult } from '../models/standard-monthly-reward-table.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { effectiveMonthlyRewardTotal } from './effective-monthly-reward.util';
import { addMonthsToYearMonth } from './reward-target-month.util';

/** 随時改定成立に必要な等級差（健康保険・厚生年金それぞれ） */
export const REVISION_GRADE_THRESHOLD = 2;

export type RevisionGradePair = {
    health: Pick<GradeLookupResult, 'grade'>;
    pension: Pick<GradeLookupResult, 'grade'>;
};

export type RevisionCalculateFn = (monthlyReward: number) => {
    health: GradeLookupResult | null;
    pension: GradeLookupResult | null;
};

export function getRevisionCalculationMonths(originMonth: string): string[] {
    return [
        originMonth,
        addMonthsToYearMonth(originMonth, 1),
        addMonthsToYearMonth(originMonth, 2),
    ];
}

export function getRevisionApplyFromMonth(originMonth: string): string {
    return addMonthsToYearMonth(originMonth, 3);
}

export function monthlyRewardTotal(reward: StandardMonthlyReward): number {
    if (reward.monthlyReward != null && reward.monthlyReward >= 0) {
        return reward.monthlyReward;
    }

    return (
        reward.basicSalary +
        reward.commutingAllowance +
        reward.positionAllowance +
        reward.housingAllowance +
        reward.fixedOvertimePay +
        reward.otherFixedAllowance +
        reward.overtimePay +
        reward.holidayPay +
        reward.nightPay +
        reward.commissionPay +
        reward.otherVariablePay
    );
}

export function calculateRevisionAverageMonthlyReward(
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    originMonth: string,
    allBonuses: BonusReward[] = [],
): number | null {
    const calculationMonths = getRevisionCalculationMonths(originMonth);
    if (!calculationMonths.every((ym) => rewardsByYearMonth[ym])) {
        return null;
    }

    const total = calculationMonths.reduce(
        (sum, ym) =>
            sum + effectiveMonthlyRewardTotal(rewardsByYearMonth[ym], ym, allBonuses),
        0,
    );
    return Math.round(total / calculationMonths.length);
}

/** 健康保険または厚生年金のいずれかで threshold 等級以上の差があれば true */
export function hasRevisionGradeDifference(
    previous: RevisionGradePair,
    revised: RevisionGradePair,
    threshold = REVISION_GRADE_THRESHOLD,
): boolean {
    const healthDiff = Math.abs(revised.health.grade - previous.health.grade);
    const pensionDiff = Math.abs(revised.pension.grade - previous.pension.grade);
    return healthDiff >= threshold || pensionDiff >= threshold;
}

export function formatRevisionGradeComparison(
    previous: RevisionGradePair,
    revised: RevisionGradePair,
): string {
    const healthDiff = revised.health.grade - previous.health.grade;
    const pensionDiff = revised.pension.grade - previous.pension.grade;
    const healthSign = healthDiff > 0 ? '+' : '';
    const pensionSign = pensionDiff > 0 ? '+' : '';
    return `健康保険 ${previous.health.grade}→${revised.health.grade}（${healthSign}${healthDiff}）、厚生年金 ${previous.pension.grade}→${revised.pension.grade}（${pensionSign}${pensionDiff}）`;
}

export type RevisionEligibilityResult =
    | { eligible: false; reason: 'no_fixed_wage_change' | 'missing_months' | 'no_previous_grades' | 'no_revised_grades' | 'insufficient_grade_difference' }
    | {
          eligible: true;
          originMonth: string;
          applyFromMonth: string;
          averageMonthlyReward: number;
          previousGrades: RevisionGradePair;
          revisedGrades: RevisionGradePair;
      };
