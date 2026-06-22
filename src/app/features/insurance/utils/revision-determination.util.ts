import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { Employee } from '../../employee/models/employee.models';
import { GradeLookupResult } from '../models/standard-monthly-reward-table.model';
import { SalaryCondition } from '../models/salary-condition.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { effectiveMonthlyRewardTotal } from './effective-monthly-reward.util';
import { sumFixedWageFields } from './fixed-wage-change.util';
import { formatPayYearMonthLabelFromWorkMonth } from './reward-pay-month.util';
import { addMonthsToYearMonth } from './reward-target-month.util';
import { salaryConditionRevisionOriginMonths } from './salary-condition.util';
import {
    getPaymentBaseDaysForPayMonth,
    PayrollPaymentMonthOffset,
    REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
} from './standard-remuneration-determination.util';
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

/** 随時改定の3か月すべてが支払基礎日数17日以上か */
export function revisionCalculationMonthsMeetPaymentBaseDays(
    employee: Employee,
    originMonth: string,
    qualificationDate: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): boolean {
    return getRevisionCalculationMonths(originMonth).every(
        (payYearMonth) =>
            getPaymentBaseDaysForPayMonth(
                payYearMonth,
                qualificationDate,
                employee.retiredDate,
                payrollPaymentMonthOffset,
            ) >= REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
    );
}

/** 指定月の固定的賃金合計（給与条件があれば適用中の条件を優先） */
function resolveFixedWageAtMonth(
    yearMonth: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    salaryConditions: SalaryCondition[],
): number | null {
    const sortedConditions = [...salaryConditions].sort((a, b) =>
        a.effectiveStartMonth.localeCompare(b.effectiveStartMonth),
    );
    const activeCondition = sortedConditions
        .filter((condition) => condition.effectiveStartMonth <= yearMonth)
        .at(-1);
    if (activeCondition) {
        return activeCondition.fixedWageTotal;
    }

    const reward = rewardsByYearMonth[yearMonth];
    if (!reward) return null;
    return sumFixedWageFields(reward);
}

/** 連続する変更月を1つのブロックにまとめたときの先頭月 */
function resolveRevisionBlockStartMonth(
    originMonth: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    salaryConditions: SalaryCondition[],
): string {
    const conditionOrigins = salaryConditionRevisionOriginMonths(salaryConditions);
    if (conditionOrigins.length > 0 && conditionOrigins.includes(originMonth)) {
        let blockStart = originMonth;
        while (conditionOrigins.includes(addMonthsToYearMonth(blockStart, -1))) {
            blockStart = addMonthsToYearMonth(blockStart, -1);
        }
        return blockStart;
    }

    const rewardOrigins = Object.entries(rewardsByYearMonth)
        .filter(([, reward]) => reward.fixedWageChanged)
        .map(([ym]) => ym);

    let blockStart = originMonth;
    while (rewardOrigins.includes(addMonthsToYearMonth(blockStart, -1))) {
        blockStart = addMonthsToYearMonth(blockStart, -1);
    }
    return blockStart;
}

/** 固定的賃金変更の方向（給与条件優先、連続変更月はブロック先頭とその前月で比較） */
export function resolveFixedWageChangeDirection(
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    originMonth: string,
    salaryConditions: SalaryCondition[] = [],
): 'increase' | 'decrease' | null {
    const sortedConditions = [...salaryConditions].sort((a, b) =>
        a.effectiveStartMonth.localeCompare(b.effectiveStartMonth),
    );
    const originCondition = sortedConditions.find(
        (condition) => condition.effectiveStartMonth === originMonth && condition.triggersRevision,
    );
    if (originCondition) {
        const previousCondition = sortedConditions
            .filter((condition) => condition.effectiveStartMonth < originMonth)
            .at(-1);
        if (previousCondition) {
            if (originCondition.fixedWageTotal > previousCondition.fixedWageTotal) {
                return 'increase';
            }
            if (originCondition.fixedWageTotal < previousCondition.fixedWageTotal) {
                return 'decrease';
            }
            return null;
        }
    }

    const blockStart = resolveRevisionBlockStartMonth(
        originMonth,
        rewardsByYearMonth,
        salaryConditions,
    );
    const originFixed = resolveFixedWageAtMonth(originMonth, rewardsByYearMonth, salaryConditions);
    const baselineFixed = resolveFixedWageAtMonth(
        addMonthsToYearMonth(blockStart, -1),
        rewardsByYearMonth,
        salaryConditions,
    );
    if (originFixed === null || baselineFixed === null) return null;

    if (originFixed > baselineFixed) return 'increase';
    if (originFixed < baselineFixed) return 'decrease';
    return null;
}

/**
 * 2等級以上変動する等級について、固定的賃金の変動方向と一致するか。
 */
export function hasRevisionGradeDirectionMatch(
    previous: RevisionGradePair,
    revised: RevisionGradePair,
    fixedWageDirection: 'increase' | 'decrease',
    threshold = REVISION_GRADE_THRESHOLD,
): boolean {
    const healthDiff = revised.health.grade - previous.health.grade;
    const pensionDiff = revised.pension.grade - previous.pension.grade;
    const healthQualifies = Math.abs(healthDiff) >= threshold;
    const pensionQualifies = Math.abs(pensionDiff) >= threshold;

    if (!healthQualifies && !pensionQualifies) return false;

    const matchesDirection = (diff: number): boolean =>
        fixedWageDirection === 'increase' ? diff > 0 : diff < 0;

    if (healthQualifies && !matchesDirection(healthDiff)) return false;
    if (pensionQualifies && !matchesDirection(pensionDiff)) return false;
    return true;
}

/** 改定適用開始月（支給年月）のラベル */
export function formatRevisionApplyFromPayMonthLabel(
    applyFromPayMonth: string,
    _payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): string {
    return formatPayYearMonthLabelFromWorkMonth(applyFromPayMonth);
}

/** 起算月から改定適用開始の支給年月ラベルを取得 */
export function formatRevisionApplyFromLabelFromOrigin(
    originMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): string {
    return formatRevisionApplyFromPayMonthLabel(
        getRevisionApplyFromMonth(originMonth),
        payrollPaymentMonthOffset,
    );
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

/** 定時決定の平均報酬月額（賞与は含めない） */
export function calculateRegularDeterminationAverageMonthlyReward(
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    calculationMonths: string[],
): number | null {
    if (calculationMonths.length === 0) return null;
    if (!calculationMonths.every((ym) => rewardsByYearMonth[ym])) return null;

    const total = calculationMonths.reduce(
        (sum, ym) => sum + monthlyRewardTotal(rewardsByYearMonth[ym]),
        0,
    );
    return Math.round(total / calculationMonths.length);
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
    | {
          eligible: false;
          reason:
              | 'no_fixed_wage_change'
              | 'missing_months'
              | 'insufficient_payment_base_days'
              | 'no_previous_grades'
              | 'no_revised_grades'
              | 'insufficient_grade_difference'
              | 'grade_direction_mismatch';
      }
    | {
          eligible: true;
          originMonth: string;
          applyFromMonth: string;
          averageMonthlyReward: number;
          previousGrades: RevisionGradePair;
          revisedGrades: RevisionGradePair;
      };
