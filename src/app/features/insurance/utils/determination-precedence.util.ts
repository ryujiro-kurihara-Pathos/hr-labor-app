import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { effectiveMonthlyRewardTotal } from './effective-monthly-reward.util';
import {
    formatYearMonthLabel,
    getAprJunYearMonths,
    getRegularBaseMonths,
    getRegularCalculationMonths,
    getRegularDeterminationBaseYear,
    PayrollPaymentMonthOffset,
} from './standard-remuneration-determination.util';
import { Employee } from '../../employee/models/employee.models';
import { addMonthsToYearMonth } from './reward-target-month.util';
import {
    RevisionCalculateFn,
    RevisionEligibilityResult,
    RevisionGradePair,
    calculateRevisionAverageMonthlyReward,
    getRevisionApplyFromMonth,
    getRevisionCalculationMonths,
    hasRevisionGradeDifference,
    formatRevisionGradeComparison,
    formatRevisionApplyFromPayMonthLabel,
} from './revision-determination.util';
import { SalaryCondition } from '../models/salary-condition.model';
import { salaryConditionRevisionOriginMonths } from './salary-condition.util';
import { formatPayMonthRangeFromWorkMonths, formatPayYearMonthLabelFromWorkMonth } from './reward-pay-month.util';

export type WinningDeterminationKind = 'initial' | 'regular' | 'revision';

/** 随時改定の起算月。給与条件がある場合は給与条件のみ（報酬の fixedWageChanged は使わない） */
export function resolveRevisionOriginMonths(
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    salaryConditions: SalaryCondition[] = [],
): string[] {
    const fromConditions = salaryConditionRevisionOriginMonths(salaryConditions);
    if (fromConditions.length > 0) {
        return fromConditions;
    }

    const rewardOrigins = Object.entries(rewardsByYearMonth)
        .filter(([, reward]) => reward.fixedWageChanged)
        .map(([ym]) => ym)
        .sort();

    return collapseConsecutiveRevisionOrigins(rewardOrigins);
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
): DeterminationCandidate[] {
    const candidates: DeterminationCandidate[] = [];

    if (targetYearMonth < firstRegularYearMonth) {
        candidates.push({
            kind: 'initial',
            effectiveFrom: qualificationYearMonth,
        });
    } else {
        const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
        const baseMonths = getRegularBaseMonths(
            employee,
            baseYear,
            qualificationDate,
            payrollPaymentMonthOffset,
        );
        const calculationMonths = getRegularCalculationMonths(
            employee,
            baseYear,
            qualificationDate,
            payrollPaymentMonthOffset,
        );

        if (
            calculationMonths.length > 0 &&
            baseMonths.every((ym) => Boolean(rewardsByYearMonth[ym])) &&
            calculationMonths.every((ym) => Boolean(rewardsByYearMonth[ym]))
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

function resolveGradesFromWinner(
    winner: DeterminationCandidate,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    employee: Employee,
    qualificationDate: string,
    qualificationYearMonth: string,
    calculate: RevisionCalculateFn,
    allBonuses: BonusReward[],
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): RevisionGradePair | null {
    switch (winner.kind) {
        case 'initial': {
            const reward = rewardsByYearMonth[qualificationYearMonth];
            if (!reward) return null;
            return {
                health: { grade: reward.healthInsuranceGrade },
                pension: { grade: reward.pensionInsuranceGrade },
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
            );
            if (!calculationMonths.every((ym) => rewardsByYearMonth[ym])) return null;

            const total = calculationMonths.reduce(
                (sum, ym) =>
                    sum +
                    effectiveMonthlyRewardTotal(rewardsByYearMonth[ym], ym, allBonuses),
                0,
            );
            const average = Math.round(total / calculationMonths.length);
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
): DeterminationCandidate[] {
    const originMonths = resolveRevisionOriginMonths(rewardsByYearMonth, salaryConditions)
        .filter((ym) => ym >= qualificationYearMonth)
        .sort();

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
        );

        if (result.eligible) {
            eligible.push({
                kind: 'revision',
                effectiveFrom: result.applyFromMonth,
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
): RevisionEligibilityResult {
    const originMonths = resolveRevisionOriginMonths(rewardsByYearMonth, salaryConditions);
    if (!originMonths.includes(originMonth)) {
        return { eligible: false, reason: 'no_fixed_wage_change' };
    }

    const originReward = rewardsByYearMonth[originMonth];
    if (!originReward) {
        return { eligible: false, reason: 'missing_months' };
    }

    const calculationMonths = getRevisionCalculationMonths(originMonth);
    if (!calculationMonths.every((ym) => rewardsByYearMonth[ym])) {
        return { eligible: false, reason: 'missing_months' };
    }

    const priorOrigins = originMonths
        .filter((ym) => ym >= qualificationYearMonth && ym < originMonth)
        .sort();

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
        );
        if (result.eligible) {
            priorEligible.push({
                kind: 'revision',
                effectiveFrom: result.applyFromMonth,
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
        ),
        ...priorEligible,
    ];
    const baselineWinner = pickBestCandidateForMonth(baselineReferenceMonth, baselineCandidates);
    if (!baselineWinner) {
        return { eligible: false, reason: 'no_previous_grades' };
    }

    const previousGrades = resolveGradesFromWinner(
        baselineWinner,
        rewardsByYearMonth,
        employee,
        qualificationDate,
        qualificationYearMonth,
        calculate,
        allBonuses,
        payrollPaymentMonthOffset,
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
): RevisionProcedureDisplayContext[] {
    const originMonths = resolveRevisionOriginMonths(rewardsByYearMonth, salaryConditions)
        .filter((ym) => ym >= qualificationYearMonth)
        .sort();

    const contexts: RevisionProcedureDisplayContext[] = [];

    for (const originMonth of originMonths) {
        const calculationMonths = getRevisionCalculationMonths(originMonth);
        if (!calculationMonths.includes(yearMonth)) continue;

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
): string[] {
    const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
    return getRegularCalculationMonths(
        employee,
        baseYear,
        qualificationDate,
        payrollPaymentMonthOffset,
    );
}

export { getAprJunYearMonths };
