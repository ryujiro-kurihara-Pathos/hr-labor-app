import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import {
    getAprJunYearMonths,
    getRegularCalculationMonths,
    getRegularDeterminationBaseYear,
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
    monthlyRewardTotal,
    formatRevisionGradeComparison,
} from './revision-determination.util';

export type WinningDeterminationKind = 'initial' | 'regular' | 'revision';

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
): DeterminationCandidate[] {
    const candidates: DeterminationCandidate[] = [];

    if (targetYearMonth < firstRegularYearMonth) {
        candidates.push({
            kind: 'initial',
            effectiveFrom: qualificationYearMonth,
        });
    } else {
        const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
        const calculationMonths = getRegularCalculationMonths(employee, baseYear, qualificationDate);

        if (
            calculationMonths.length > 0 &&
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
            const average = calculateRevisionAverageMonthlyReward(rewardsByYearMonth, originMonth);
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
            );
            if (!calculationMonths.every((ym) => rewardsByYearMonth[ym])) return null;

            const total = calculationMonths.reduce(
                (sum, ym) => sum + monthlyRewardTotal(rewardsByYearMonth[ym]),
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
): DeterminationCandidate[] {
    const originMonths = Object.entries(rewardsByYearMonth)
        .filter(([, reward]) => reward.fixedWageChanged)
        .map(([ym]) => ym)
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
): RevisionEligibilityResult {
    const originReward = rewardsByYearMonth[originMonth];
    if (!originReward?.fixedWageChanged) {
        return { eligible: false, reason: 'no_fixed_wage_change' };
    }

    const calculationMonths = getRevisionCalculationMonths(originMonth);
    if (!calculationMonths.every((ym) => rewardsByYearMonth[ym])) {
        return { eligible: false, reason: 'missing_months' };
    }

    const priorOrigins = Object.entries(rewardsByYearMonth)
        .filter(([, reward]) => reward.fixedWageChanged)
        .map(([ym]) => ym)
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
        );
        if (result.eligible) {
            priorEligible.push({
                kind: 'revision',
                effectiveFrom: result.applyFromMonth,
                revisionOriginMonth: priorOrigin,
            });
        }
    }

    const monthBeforeChange = addMonthsToYearMonth(originMonth, -1);
    const baselineCandidates = [
        ...buildInitialRegularCandidates(
            monthBeforeChange,
            qualificationYearMonth,
            firstRegularYearMonth,
            employee,
            qualificationDate,
            rewardsByYearMonth,
        ),
        ...priorEligible,
    ];
    const baselineWinner = pickBestCandidateForMonth(monthBeforeChange, baselineCandidates);
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
    );
    if (!previousGrades) {
        return { eligible: false, reason: 'no_previous_grades' };
    }

    const averageMonthlyReward = calculateRevisionAverageMonthlyReward(
        rewardsByYearMonth,
        originMonth,
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
        applyFromMonth: getRevisionApplyFromMonth(originMonth),
        averageMonthlyReward,
        previousGrades,
        revisedGrades,
    };
}

export { formatRevisionGradeComparison };

/** 対象年月に適用される決定候補のうち、最も新しい effectiveFrom を選ぶ */
export function pickWinningDeterminationCandidate(
    targetYearMonth: string,
    qualificationYearMonth: string,
    firstRegularYearMonth: string,
    employee: Employee,
    qualificationDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    calculate: RevisionCalculateFn,
): DeterminationCandidate | null {
    const revisionCandidates = listEligibleRevisionCandidates(
        qualificationYearMonth,
        firstRegularYearMonth,
        employee,
        qualificationDate,
        rewardsByYearMonth,
        calculate,
    );

    const candidates = [
        ...buildInitialRegularCandidates(
            targetYearMonth,
            qualificationYearMonth,
            firstRegularYearMonth,
            employee,
            qualificationDate,
            rewardsByYearMonth,
        ),
        ...revisionCandidates,
    ];

    return pickBestCandidateForMonth(targetYearMonth, candidates);
}

export function getRegularCalculationMonthsForTarget(
    targetYearMonth: string,
    employee: Employee,
    qualificationDate: string,
): string[] {
    const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
    return getRegularCalculationMonths(employee, baseYear, qualificationDate);
}

export { getAprJunYearMonths };
