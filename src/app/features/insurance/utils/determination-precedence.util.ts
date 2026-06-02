import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import {
    getAprJunYearMonths,
    getRegularCalculationMonths,
    getRegularDeterminationBaseYear,
} from './standard-remuneration-determination.util';
import { Employee } from '../../employee/models/employee.models';

export type WinningDeterminationKind = 'initial' | 'regular' | 'revision';

export type DeterminationCandidate = {
    kind: WinningDeterminationKind;
    effectiveFrom: string;
    revisionOriginMonth?: string;
    regularBaseYear?: number;
};

/** 対象年月に適用される決定候補のうち、最も新しい effectiveFrom を選ぶ */
export function pickWinningDeterminationCandidate(
    targetYearMonth: string,
    qualificationYearMonth: string,
    firstRegularYearMonth: string,
    employee: Employee,
    qualificationDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
): DeterminationCandidate | null {
    const candidates: DeterminationCandidate[] = [];

    if (targetYearMonth < firstRegularYearMonth) {
        candidates.push({
            kind: 'initial',
            effectiveFrom: qualificationYearMonth,
        });
    } else {
        const baseYear = getRegularDeterminationBaseYear(targetYearMonth);
        const calculationMonths = getRegularCalculationMonths(employee, baseYear, qualificationDate);
        const allRegularMonthsPresent =
            calculationMonths.length > 0 &&
            calculationMonths.every((ym) => Boolean(rewardsByYearMonth[ym]));

        if (allRegularMonthsPresent) {
            candidates.push({
                kind: 'regular',
                effectiveFrom: `${baseYear}-09`,
                regularBaseYear: baseYear,
            });
        }
    }

    for (const [ym, reward] of Object.entries(rewardsByYearMonth)) {
        if (!reward.fixedWageChanged) continue;
        if (ym > targetYearMonth) continue;
        if (ym < qualificationYearMonth) continue;
        candidates.push({
            kind: 'revision',
            effectiveFrom: ym,
            revisionOriginMonth: ym,
        });
    }

    const applicable = candidates.filter((c) => c.effectiveFrom <= targetYearMonth);
    if (applicable.length === 0) return null;

    return applicable.reduce((best, current) => {
        if (current.effectiveFrom > best.effectiveFrom) return current;
        if (current.effectiveFrom < best.effectiveFrom) return best;
        if (current.kind === 'revision') return current;
        return best;
    });
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
