import { BonusReward, BonusRewardStatus } from '../models/bonus-reward.model';

/** 既存データ（status 未設定）は確定として扱う */
export function normalizeBonusStatus(
    bonus: BonusReward | null | undefined,
): BonusRewardStatus | 'default' {
    if (!bonus) return 'default';
    if (!bonus.status) return 'confirmed';
    return bonus.status;
}

export function isBonusConfirmed(bonus: BonusReward | null | undefined): boolean {
    return normalizeBonusStatus(bonus) === 'confirmed';
}

export function isBonusDraft(bonus: BonusReward | null | undefined): boolean {
    return normalizeBonusStatus(bonus) === 'draft';
}

export function confirmedBonuses(bonuses: BonusReward[]): BonusReward[] {
    return bonuses.filter((bonus) => isBonusConfirmed(bonus));
}
