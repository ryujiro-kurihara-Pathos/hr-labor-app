import {
    GradeLookupResult,
    StandardMonthlyRewardTableRow,
} from '../models/standard-monthly-reward-table.model';

export function lookupGrade(
    rows: StandardMonthlyRewardTableRow[],
    monthlyReward: number,
): GradeLookupResult | null {
    // 0円・未入力は等級表の第1級（下限0円）に誤って当たるため判定しない
    if (!Number.isFinite(monthlyReward) || monthlyReward <= 0) return null;

    for (const row of rows) {
        if (monthlyReward >= row.minInclusive && monthlyReward < row.maxExclusive) {
            return {
                grade: row.grade,
                standardMonthlyAmount: row.standardMonthlyAmount,
            };
        }
    }
    return null;
}

/** [等級, 標準報酬月額, 報酬月額以上, 報酬月額未満] — 未満が null のときは上限なし */
export function rowsFromTuples(
    tuples: ReadonlyArray<readonly [number, number, number, number | null]>,
): StandardMonthlyRewardTableRow[] {
    return tuples.map(([grade, standardMonthlyAmount, minInclusive, maxExclusive]) => ({
        grade,
        standardMonthlyAmount,
        minInclusive,
        maxExclusive: maxExclusive ?? Number.MAX_SAFE_INTEGER,
    }));
}
