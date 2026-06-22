/** 保険料の1円未満端数: 50銭以下は切捨て、50銭超は切上げ */
export function roundInsurancePremium(amount: number): number {
    const fraction = amount - Math.floor(amount);
    return fraction > 0.5 ? Math.ceil(amount) : Math.floor(amount);
}

export type InsurancePremiumShares = {
    /** 保険料全体（標準報酬 × 料率、円単位に丸め） */
    totalPremium: number;
    /** 本人負担分（端数処理後） */
    employeePremium: number;
    /** 会社負担分（保険料全体 − 本人負担分） */
    employerPremium: number;
};

/**
 * 社会保険料の本人・会社負担分を算出する。
 * 本人負担のみ端数処理し、会社負担は保険料全体から差し引く。
 */
export function calculateInsurancePremiumShares(
    amount: number,
    totalRate: number,
): InsurancePremiumShares {
    const totalExact = amount * totalRate;
    const employeePremium = roundInsurancePremium(totalExact / 2);
    const totalPremium = Math.round(totalExact);
    const employerPremium = totalPremium - employeePremium;

    return { totalPremium, employeePremium, employerPremium };
}

/** 折半料率（本人分）から保険料全体の料率を求める */
export function insuranceTotalRateFromEmployeeRate(employeeRate: number | null | undefined): number | null {
    if (employeeRate === null || employeeRate === undefined || !Number.isFinite(employeeRate)) {
        return null;
    }
    return employeeRate * 2;
}
