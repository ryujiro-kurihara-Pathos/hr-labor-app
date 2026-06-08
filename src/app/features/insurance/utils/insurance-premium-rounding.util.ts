/** 保険料の1円未満端数: 50銭以下は切捨て、50銭超は切上げ */
export function roundInsurancePremium(amount: number): number {
    const fraction = amount - Math.floor(amount);
    return fraction > 0.5 ? Math.ceil(amount) : Math.floor(amount);
}
