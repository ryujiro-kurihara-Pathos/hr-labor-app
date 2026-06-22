import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import {
    formatYearMonthLabel,
    getAprJunYearMonths,
    getRegularCalculationMonths,
    getRegularDeterminationBaseYear,
    PayrollPaymentMonthOffset,
    REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
} from './standard-remuneration-determination.util';
import { Employee } from '../../employee/models/employee.models';
import { addMonthsToYearMonth } from './reward-target-month.util';
import {
    RevisionCalculateFn,
    RevisionEligibilityResult,
    RevisionGradePair,
    calculateRegularDeterminationAverageMonthlyReward,
    calculateRevisionAverageMonthlyReward,
    getRevisionApplyFromMonth,
    getRevisionCalculationMonths,
    hasRevisionGradeDifference,
    hasRevisionGradeDirectionMatch,
    formatRevisionGradeComparison,
    formatRevisionApplyFromPayMonthLabel,
    resolveFixedWageChangeDirection,
    revisionCalculationMonthsMeetPaymentBaseDays,
} from './revision-determination.util';
import { SalaryCondition } from '../models/salary-condition.model';
import { mergeFixedWageChangedMonths, salaryConditionRevisionOriginMonths } from './salary-condition.util';
import { formatPayMonthRangeFromWorkMonths, formatPayYearMonthLabelFromWorkMonth, isConfirmedExactRewardRegisteredForPayMonth, lookupConfirmedExactRewardByPayMonth, resolveQualificationRewardPayYearMonth } from './reward-pay-month.util';
import { resolveQualificationJoinMonthReward } from '../../social-insurance/utils/qualification-reward.util';
import { effectiveMonthlyRewardTotal } from './effective-monthly-reward.util';
import { yearMonthFromDateString } from './reward-target-month.util';
import { isRewardConfirmed } from './reward-status.util';

export type WinningDeterminationKind = 'initial' | 'regular' | 'revision';

/** 随時改定の起算月（給与条件と確定済み報酬の fixedWageChanged を統合） */
export function resolveRevisionOriginMonths(
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    salaryConditions: SalaryCondition[] = [],
): string[] {
    const fromConditions = salaryConditionRevisionOriginMonths(salaryConditions);
    const fromRewards = Object.entries(rewardsByYearMonth)
        .filter(([, reward]) => reward.fixedWageChanged && isRewardConfirmed(reward))
        .map(([ym]) => ym);

    return collapseConsecutiveRevisionOrigins(
        mergeFixedWageChangedMonths(fromRewards, fromConditions),
    );
}

/** 随時改定起算月の下限（資格取得後の初回支給月以降の支給年月） */
export function filterRevisionOriginMonthsAfterQualification(
    originMonths: string[],
    qualificationYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): string[] {
    const minPayYearMonth = resolveQualificationRewardPayYearMonth(
        qualificationYearMonth,
        payrollPaymentMonthOffset,
    );
    return originMonths.filter((ym) => ym >= minPayYearMonth);
}

/**
 * 連続する起算月（例: 5月・6月）では直近の変更のみ採用する。
 * 給与条件変更の翌月同期などで前月に誤って fixedWageChanged が立つケースを抑える。
 */
export function collapseConsecutiveRevisionOrigins(originMonths: string[]): string[] {
    if (originMonths.length <= 1) return originMonths;

    const result: string[] = [];
    for (const origin of originMonths) {
        const previous = result[result.length - 1];
        if (previous && origin === addMonthsToYearMonth(previous, 1)) {
            result[result.length - 1] = origin;
            continue;
        }
        result.push(origin);
    }
    return result;
}

export type DeterminationCandidate = {
    kind: WinningDeterminationKind;
    effectiveFrom: string;
    revisionOriginMonth?: string;
    regularBaseYear?: number;
};

function buildInitialRegularCandidates(
    targetYearMonth: string,
    qualificationYearMonth: string,
    firstRegularYearMonth: string,
    employee: Employee,
    qualificationDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    minPaymentBaseDays: number = REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
): DeterminationCandidate[] {
    const candidates: DeterminationCandidate[] = [];

    if (targetYearMonth < firstRegularYearMonth) {
        candidates.push({
            kind: 'initial',
            effectiveFrom: resolveQualificationRewardPayYearMonth(
                qualificationYearMonth,
                payrollPaymentMonthOffset,
            ),
        });
    } else {
        const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
        const calculationMonths = getRegularCalculationMonths(
            employee,
            baseYear,
            qualificationDate,
            payrollPaymentMonthOffset,
            minPaymentBaseDays,
        );

        if (
            calculationMonths.length > 0 &&
            calculationMonths.every((ym) =>
                isConfirmedExactRewardRegisteredForPayMonth(rewardsByYearMonth, ym),
            )
        ) {
            candidates.push({
                kind: 'regular',
                effectiveFrom: `${baseYear}-09`,
                regularBaseYear: baseYear,
            });
        }
    }

    return candidates;
}

/**
 * 随時改定の改定前等級を、起算月前月時点の決定から解決する。
 * 標準報酬決定サービスと同様、定時決定前で候補が無い場合は資格取得時決定にフォールバックする。
 */
function resolveRevisionPreviousGrades(
    baselineReferenceMonth: string,
    qualificationYearMonth: string,
    firstRegularYearMonth: string,
    baselineCandidates: DeterminationCandidate[],
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    employee: Employee,
    qualificationDate: string,
    calculate: RevisionCalculateFn,
    allBonuses: BonusReward[],
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
    regularDeterminationMinPaymentBaseDays: number,
    salaryConditions: SalaryCondition[],
): RevisionGradePair | null {
    const baselineWinner = pickBestCandidateForMonth(baselineReferenceMonth, baselineCandidates);
    if (baselineWinner) {
        return resolveGradesFromWinner(
            baselineWinner,
            rewardsByYearMonth,
            employee,
            qualificationDate,
            qualificationYearMonth,
            calculate,
            allBonuses,
            payrollPaymentMonthOffset,
            regularDeterminationMinPaymentBaseDays,
            salaryConditions,
        );
    }

    if (baselineReferenceMonth >= firstRegularYearMonth) {
        return null;
    }

    return resolveGradesFromWinner(
        {
            kind: 'initial',
            effectiveFrom: resolveQualificationRewardPayYearMonth(
                qualificationYearMonth,
                payrollPaymentMonthOffset,
            ),
        },
        rewardsByYearMonth,
        employee,
        qualificationDate,
        qualificationYearMonth,
        calculate,
        allBonuses,
        payrollPaymentMonthOffset,
        regularDeterminationMinPaymentBaseDays,
        salaryConditions,
    );
}

/** 随時改定の改定前等級に使う資格取得時決定の報酬（入社月見込み給料を優先し、資格取得時決定と同じ基準） */
function resolveRevisionBaselineInitialReward(
    employee: Employee,
    qualificationDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
    salaryConditions: SalaryCondition[],
): { reward: StandardMonthlyReward; referenceYearMonth: string } | null {
    const qualificationYearMonth = yearMonthFromDateString(qualificationDate);
    if (!qualificationYearMonth) return null;

    const { reward } = resolveQualificationJoinMonthReward({
        joinedDate: qualificationDate,
        companyId: employee.companyId,
        employeeId: employee.id,
        employmentType: employee.employmentType,
        salaryConditions,
        rewardsByYearMonth,
        payrollPaymentMonthOffset,
    });
    if (!reward) return null;

    return {
        reward,
        referenceYearMonth: qualificationYearMonth,
    };
}

function resolveGradesFromWinner(
    winner: DeterminationCandidate,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    employee: Employee,
    qualificationDate: string,
    qualificationYearMonth: string,
    calculate: RevisionCalculateFn,
    allBonuses: BonusReward[],
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    minPaymentBaseDays: number = REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
    salaryConditions: SalaryCondition[] = [],
): RevisionGradePair | null {
    switch (winner.kind) {
        case 'initial': {
            const baseline = resolveRevisionBaselineInitialReward(
                employee,
                qualificationDate,
                rewardsByYearMonth,
                payrollPaymentMonthOffset,
                salaryConditions,
            );
            if (!baseline) return null;
            const monthlyReward = effectiveMonthlyRewardTotal(
                baseline.reward,
                baseline.referenceYearMonth,
                allBonuses,
            );
            const calculation = calculate(monthlyReward);
            if (!calculation.health || !calculation.pension) return null;
            return {
                health: { grade: calculation.health.grade },
                pension: { grade: calculation.pension.grade },
            };
        }
        case 'revision': {
            const originMonth = winner.revisionOriginMonth!;
            const average = calculateRevisionAverageMonthlyReward(
                rewardsByYearMonth,
                originMonth,
                allBonuses,
            );
            if (average === null) return null;
            const calculation = calculate(average);
            if (!calculation.health || !calculation.pension) return null;
            return {
                health: { grade: calculation.health.grade },
                pension: { grade: calculation.pension.grade },
            };
        }
        case 'regular': {
            const baseYear =
                winner.regularBaseYear ??
                getRegularDeterminationBaseYear(winner.effectiveFrom);
            const calculationMonths = getRegularCalculationMonths(
                employee,
                baseYear,
                qualificationDate,
                payrollPaymentMonthOffset,
                minPaymentBaseDays,
            );
            if (!calculationMonths.every((ym) =>
                isConfirmedExactRewardRegisteredForPayMonth(rewardsByYearMonth, ym),
            )) return null;

            const average = calculateRegularDeterminationAverageMonthlyReward(
                rewardsByYearMonth,
                calculationMonths,
            );
            if (average === null) return null;
            const calculation = calculate(average);
            if (!calculation.health || !calculation.pension) return null;
            return {
                health: { grade: calculation.health.grade },
                pension: { grade: calculation.pension.grade },
            };
        }
    }
}

function pickBestCandidateForMonth(
    targetYearMonth: string,
    candidates: DeterminationCandidate[],
): DeterminationCandidate | null {
    const applicable = candidates.filter((candidate) => candidate.effectiveFrom <= targetYearMonth);
    if (applicable.length === 0) return null;

    return applicable.reduce((best, current) => {
        if (current.effectiveFrom > best.effectiveFrom) return current;
        if (current.effectiveFrom < best.effectiveFrom) return best;
        if (current.kind === 'revision') return current;
        return best;
    });
}

/** 2等級差条件を満たす随時改定候補を、変更月の古い順に評価して返す */
export function listEligibleRevisionCandidates(
    qualificationYearMonth: string,
    firstRegularYearMonth: string,
    employee: Employee,
    qualificationDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    calculate: RevisionCalculateFn,
    allBonuses: BonusReward[] = [],
    salaryConditions: SalaryCondition[] = [],
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    regularDeterminationMinPaymentBaseDays: number = REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
): DeterminationCandidate[] {
    const originMonths = filterRevisionOriginMonthsAfterQualification(
        resolveRevisionOriginMonths(rewardsByYearMonth, salaryConditions),
        qualificationYearMonth,
        payrollPaymentMonthOffset,
    ).sort();

    const eligible: DeterminationCandidate[] = [];

    for (const originMonth of originMonths) {
        const result = evaluateRevisionAtOrigin(
            originMonth,
            qualificationYearMonth,
            firstRegularYearMonth,
            employee,
            qualificationDate,
            rewardsByYearMonth,
            calculate,
            allBonuses,
            payrollPaymentMonthOffset,
            salaryConditions,
            regularDeterminationMinPaymentBaseDays,
        );

        if (result.eligible) {
            eligible.push({
                kind: 'revision',
                effectiveFrom: getRevisionApplyFromMonth(originMonth),
                revisionOriginMonth: originMonth,
            });
        }
    }

    return eligible;
}

/** 単一の変更月について随時改定が成立するか評価する */
export function evaluateRevisionAtOrigin(
    originMonth: string,
    qualificationYearMonth: string,
    firstRegularYearMonth: string,
    employee: Employee,
    qualificationDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    calculate: RevisionCalculateFn,
    allBonuses: BonusReward[] = [],
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    salaryConditions: SalaryCondition[] = [],
    regularDeterminationMinPaymentBaseDays: number = REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
): RevisionEligibilityResult {
    const originMonths = resolveRevisionOriginMonths(rewardsByYearMonth, salaryConditions);
    if (!originMonths.includes(originMonth)) {
        return { eligible: false, reason: 'no_fixed_wage_change' };
    }

    const originReward = lookupConfirmedExactRewardByPayMonth(rewardsByYearMonth, originMonth);
    if (!originReward) {
        return { eligible: false, reason: 'missing_months' };
    }

    const calculationMonths = getRevisionCalculationMonths(originMonth);
    if (
        !calculationMonths.every((ym) =>
            isConfirmedExactRewardRegisteredForPayMonth(rewardsByYearMonth, ym),
        )
    ) {
        return { eligible: false, reason: 'missing_months' };
    }

    if (
        !revisionCalculationMonthsMeetPaymentBaseDays(
            employee,
            originMonth,
            qualificationDate,
            payrollPaymentMonthOffset,
        )
    ) {
        return { eligible: false, reason: 'insufficient_payment_base_days' };
    }

    const allOriginMonths = filterRevisionOriginMonthsAfterQualification(
        resolveRevisionOriginMonths(rewardsByYearMonth, salaryConditions),
        qualificationYearMonth,
        payrollPaymentMonthOffset,
    );
    const priorOrigins = allOriginMonths.filter((ym) => ym < originMonth).sort();

    const priorEligible: DeterminationCandidate[] = [];
    for (const priorOrigin of priorOrigins) {
        const result = evaluateRevisionAtOrigin(
            priorOrigin,
            qualificationYearMonth,
            firstRegularYearMonth,
            employee,
            qualificationDate,
            rewardsByYearMonth,
            calculate,
            allBonuses,
            payrollPaymentMonthOffset,
            salaryConditions,
            regularDeterminationMinPaymentBaseDays,
        );
        if (result.eligible) {
            priorEligible.push({
                kind: 'revision',
                effectiveFrom: getRevisionApplyFromMonth(priorOrigin),
                revisionOriginMonth: priorOrigin,
            });
        }
    }

    const applyFromMonth = getRevisionApplyFromMonth(originMonth);
    const priorRevisionAppliesBeforeThis = priorEligible.some(
        (candidate) => candidate.effectiveFrom < applyFromMonth,
    );
    /** 直前の随時改定がある場合は、今回の改定適用直前月時点の等級と比較する */
    const baselineReferenceMonth = priorRevisionAppliesBeforeThis
        ? addMonthsToYearMonth(applyFromMonth, -1)
        : addMonthsToYearMonth(originMonth, -1);

    const baselineCandidates = [
        ...buildInitialRegularCandidates(
            baselineReferenceMonth,
            qualificationYearMonth,
            firstRegularYearMonth,
            employee,
            qualificationDate,
            rewardsByYearMonth,
            payrollPaymentMonthOffset,
            regularDeterminationMinPaymentBaseDays,
        ),
        ...priorEligible,
    ];
    const previousGrades = resolveRevisionPreviousGrades(
        baselineReferenceMonth,
        qualificationYearMonth,
        firstRegularYearMonth,
        baselineCandidates,
        rewardsByYearMonth,
        employee,
        qualificationDate,
        calculate,
        allBonuses,
        payrollPaymentMonthOffset,
        regularDeterminationMinPaymentBaseDays,
        salaryConditions,
    );
    if (!previousGrades) {
        return { eligible: false, reason: 'no_previous_grades' };
    }

    const averageMonthlyReward = calculateRevisionAverageMonthlyReward(
        rewardsByYearMonth,
        originMonth,
        allBonuses,
    );
    if (averageMonthlyReward === null) {
        return { eligible: false, reason: 'missing_months' };
    }

    const revisedCalculation = calculate(averageMonthlyReward);
    if (!revisedCalculation.health || !revisedCalculation.pension) {
        return { eligible: false, reason: 'no_revised_grades' };
    }

    const revisedGrades: RevisionGradePair = {
        health: { grade: revisedCalculation.health.grade },
        pension: { grade: revisedCalculation.pension.grade },
    };

    if (!hasRevisionGradeDifference(previousGrades, revisedGrades)) {
        return { eligible: false, reason: 'insufficient_grade_difference' };
    }

    const fixedWageDirection = resolveFixedWageChangeDirection(
        rewardsByYearMonth,
        originMonth,
        salaryConditions,
    );
    if (
        !fixedWageDirection
        || !hasRevisionGradeDirectionMatch(previousGrades, revisedGrades, fixedWageDirection)
    ) {
        return { eligible: false, reason: 'grade_direction_mismatch' };
    }

    return {
        eligible: true,
        originMonth,
        applyFromMonth,
        averageMonthlyReward,
        previousGrades,
        revisedGrades,
    };
}

export { formatRevisionGradeComparison };
export type { RevisionEligibilityResult };

export type RevisionEligibilityForPayMonth = {
    originMonth: string;
    result: RevisionEligibilityResult;
};

/** 表示中の支給月が随時改定の起算月または算定3か月に含まれる場合、その成立可否を評価する */
export function evaluateRevisionEligibilityForPayMonth(
    payYearMonth: string,
    qualificationYearMonth: string,
    firstRegularYearMonth: string,
    employee: Employee,
    qualificationDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    calculate: RevisionCalculateFn,
    allBonuses: BonusReward[] = [],
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    salaryConditions: SalaryCondition[] = [],
    regularDeterminationMinPaymentBaseDays: number = REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
): RevisionEligibilityForPayMonth | null {
    const originMonths = filterRevisionOriginMonthsAfterQualification(
        resolveRevisionOriginMonths(rewardsByYearMonth, salaryConditions),
        qualificationYearMonth,
        payrollPaymentMonthOffset,
    ).sort();

    for (const originMonth of originMonths) {
        const calculationMonths = getRevisionCalculationMonths(originMonth);
        if (!calculationMonths.includes(payYearMonth)) continue;

        const result = evaluateRevisionAtOrigin(
            originMonth,
            qualificationYearMonth,
            firstRegularYearMonth,
            employee,
            qualificationDate,
            rewardsByYearMonth,
            calculate,
            allBonuses,
            payrollPaymentMonthOffset,
            salaryConditions,
            regularDeterminationMinPaymentBaseDays,
        );

        return { originMonth, result };
    }

    return null;
}

/** 随時改定の成立状況に応じた注意メッセージ（成立済み・届出表示中は null） */
export function formatRevisionEligibilityWarningMessage(
    entry: RevisionEligibilityForPayMonth,
    changedFieldLabels: string[],
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): string | null {
    if (entry.result.eligible) return null;

    const calculationMonths = getRevisionCalculationMonths(entry.originMonth);
    const windowLabel = formatPayMonthRangeFromWorkMonths(
        calculationMonths[0]!,
        calculationMonths[2]!,
        payrollPaymentMonthOffset,
    );
    const fieldsLabel = changedFieldLabels.length > 0
        ? changedFieldLabels.join('・')
        : '固定的賃金';

    switch (entry.result.reason) {
        case 'missing_months':
            return `固定的賃金に変更があります（${fieldsLabel}）。随時改定の算定対象期間（${windowLabel}）の報酬がすべて確定すると、月額変更届の対象になります。`;
        case 'insufficient_payment_base_days':
            return `固定的賃金に変更があります（${fieldsLabel}）が、算定対象期間（${windowLabel}）の支払基礎日数が17日未満の月があるため、随時改定は成立しません。`;
        case 'insufficient_grade_difference':
            return `固定的賃金に変更があります（${fieldsLabel}）が、改定前後で2等級以上の差がないため、随時改定は成立しません（算定期間: ${windowLabel}）。`;
        case 'grade_direction_mismatch':
            return `固定的賃金に変更があります（${fieldsLabel}）が、固定的賃金の増減と等級変動の方向が一致しないため、随時改定は成立しません（算定期間: ${windowLabel}）。`;
        case 'no_previous_grades':
            return `固定的賃金に変更があります（${fieldsLabel}）が、改定前の標準報酬月額を特定できないため、随時改定を判定できません。`;
        case 'no_revised_grades':
            return `固定的賃金に変更があります（${fieldsLabel}）が、算定対象期間（${windowLabel}）の平均報酬から等級を判定できません。`;
        case 'no_fixed_wage_change':
            return null;
    }
}

export type RevisionProcedureDisplayContext = {
    originMonth: string;
    applyFromMonth: string;
    calculationMonths: string[];
    lastCalculationMonth: string;
    windowLabel: string;
    applyFromLabel: string;
    description: string;
};

function buildRevisionProcedureDisplayContext(
    originMonth: string,
    result: Extract<RevisionEligibilityResult, { eligible: true }>,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): RevisionProcedureDisplayContext {
    const calculationMonths = getRevisionCalculationMonths(originMonth);
    const lastCalculationMonth = calculationMonths[2]!;
    const windowLabel = formatPayMonthRangeFromWorkMonths(
        calculationMonths[0]!,
        lastCalculationMonth,
        payrollPaymentMonthOffset,
    );
    const applyFromLabel = formatRevisionApplyFromPayMonthLabel(
        result.applyFromMonth,
        payrollPaymentMonthOffset,
    );

    return {
        originMonth,
        applyFromMonth: result.applyFromMonth,
        calculationMonths,
        lastCalculationMonth,
        windowLabel,
        applyFromLabel,
        description: `${applyFromLabel}から随時改定の対象です（${windowLabel}・平均報酬月額 ${result.averageMonthlyReward.toLocaleString()} 円、${formatRevisionGradeComparison(result.previousGrades, result.revisedGrades)}）。`,
    };
}

/** 表示中の月に該当する、成立済み随時改定の月額変更届コンテキスト（複数可） */
export function listEligibleRevisionProcedureContextsForMonth(
    yearMonth: string,
    qualificationYearMonth: string,
    firstRegularYearMonth: string,
    employee: Employee,
    qualificationDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    calculate: RevisionCalculateFn,
    allBonuses: BonusReward[] = [],
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    salaryConditions: SalaryCondition[] = [],
    regularDeterminationMinPaymentBaseDays: number = REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
): RevisionProcedureDisplayContext[] {
    const originMonths = filterRevisionOriginMonthsAfterQualification(
        resolveRevisionOriginMonths(rewardsByYearMonth, salaryConditions),
        qualificationYearMonth,
        payrollPaymentMonthOffset,
    ).sort();

    const contexts: RevisionProcedureDisplayContext[] = [];

    for (const originMonth of originMonths) {
        const calculationMonths = getRevisionCalculationMonths(originMonth);
        if (!calculationMonths.includes(yearMonth)) continue;

        // 随時改定が成立するか評価
        const result = evaluateRevisionAtOrigin(
            originMonth,
            qualificationYearMonth,
            firstRegularYearMonth,
            employee,
            qualificationDate,
            rewardsByYearMonth,
            calculate,
            allBonuses,
            payrollPaymentMonthOffset,
            salaryConditions,
            regularDeterminationMinPaymentBaseDays,
        );
        if (!result.eligible) continue;

        contexts.push(buildRevisionProcedureDisplayContext(originMonth, result, payrollPaymentMonthOffset));
    }

    return contexts;
}

/**
 * 定時決定（baseYear年9月適用）と同一サイクル内で随時改定が成立しているか。
 * 成立している場合、当該年の定時決定は適用しない（算定基礎届も不要）。
 */
export function revisionSupersedesRegularDeterminationForBaseYear(
    baseYear: number,
    revisionCandidates: DeterminationCandidate[],
): boolean {
    const regularEffectiveFrom = `${baseYear}-09`;
    const cycleStart = `${baseYear - 1}-09`;
    return revisionCandidates.some(
        (candidate) =>
            candidate.kind === 'revision'
            && candidate.effectiveFrom >= cycleStart
            && candidate.effectiveFrom <= regularEffectiveFrom,
    );
}

function withoutRegularDeterminationsSuppressedByRevision(
    candidates: DeterminationCandidate[],
    revisionCandidates: DeterminationCandidate[],
): DeterminationCandidate[] {
    return candidates.filter((candidate) => {
        if (candidate.kind !== 'regular') return true;
        const baseYear =
            candidate.regularBaseYear
            ?? getRegularDeterminationBaseYear(candidate.effectiveFrom);
        return !revisionSupersedesRegularDeterminationForBaseYear(baseYear, revisionCandidates);
    });
}

/**
 * 指定月より前に適用開始する随時改定が成立しているか。
 * 定時決定（9月適用）より先に随時改定が入る場合、算定基礎届は不要。
 */
export function hasEligibleRevisionBeforeMonth(
    beforeYearMonth: string,
    qualificationYearMonth: string,
    firstRegularYearMonth: string,
    employee: Employee,
    qualificationDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    calculate: RevisionCalculateFn,
    allBonuses: BonusReward[] = [],
    salaryConditions: SalaryCondition[] = [],
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    regularDeterminationMinPaymentBaseDays: number = REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
): boolean {
    const baseYear = Number(beforeYearMonth.slice(0, 4));
    const revisionCandidates = listEligibleRevisionCandidates(
        qualificationYearMonth,
        firstRegularYearMonth,
        employee,
        qualificationDate,
        rewardsByYearMonth,
        calculate,
        allBonuses,
        salaryConditions,
        payrollPaymentMonthOffset,
        regularDeterminationMinPaymentBaseDays,
    );
    return revisionSupersedesRegularDeterminationForBaseYear(baseYear, revisionCandidates);
}

/** 対象年月に適用される決定候補のうち、最も新しい effectiveFrom を選ぶ */
export function pickWinningDeterminationCandidate(
    targetYearMonth: string,
    qualificationYearMonth: string,
    firstRegularYearMonth: string,
    employee: Employee,
    qualificationDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    calculate: RevisionCalculateFn,
    allBonuses: BonusReward[] = [],
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    salaryConditions: SalaryCondition[] = [],
    regularDeterminationMinPaymentBaseDays: number = REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
): DeterminationCandidate | null {
    const revisionCandidates = listEligibleRevisionCandidates(
        qualificationYearMonth,
        firstRegularYearMonth,
        employee,
        qualificationDate,
        rewardsByYearMonth,
        calculate,
        allBonuses,
        salaryConditions,
        payrollPaymentMonthOffset,
        regularDeterminationMinPaymentBaseDays,
    );

    const candidates = withoutRegularDeterminationsSuppressedByRevision(
        [
            ...buildInitialRegularCandidates(
                targetYearMonth,
                qualificationYearMonth,
                firstRegularYearMonth,
                employee,
                qualificationDate,
                rewardsByYearMonth,
                payrollPaymentMonthOffset,
                regularDeterminationMinPaymentBaseDays,
            ),
            ...revisionCandidates,
        ],
        revisionCandidates,
    );

    return pickBestCandidateForMonth(targetYearMonth, candidates);
}

export function getRegularCalculationMonthsForTarget(
    targetYearMonth: string,
    employee: Employee,
    qualificationDate: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
    minPaymentBaseDays: number = REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
): string[] {
    const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
    return getRegularCalculationMonths(
        employee,
        baseYear,
        qualificationDate,
        payrollPaymentMonthOffset,
        minPaymentBaseDays,
    );
}

export { getAprJunYearMonths };
