import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';

/** パート向けフォームの「その他手当」表示用（変動賃金を含めて集約） */
export function partTimeOtherAllowanceTotal(
    reward: Pick<
        StandardMonthlyReward,
        | 'otherFixedAllowance'
        | 'overtimePay'
        | 'holidayPay'
        | 'nightPay'
        | 'commissionPay'
        | 'otherVariablePay'
    >,
): number {
    return (
        reward.otherFixedAllowance +
        reward.overtimePay +
        reward.holidayPay +
        reward.nightPay +
        reward.commissionPay +
        reward.otherVariablePay
    );
}

/** パートの報酬月額（月額報酬＋通勤手当＋その他手当） */
export function partTimeMonthlyRewardTotal(
    basicSalary: number,
    commutingAllowance: number,
    otherAllowance: number,
): number {
    return basicSalary + commutingAllowance + otherAllowance;
}

/** 保存済みレコードからパートの報酬月額を取得 */
export function partTimeInsuranceMonthlyRewardFromRecord(reward: StandardMonthlyReward): number {
    if (reward.monthlyReward != null && reward.monthlyReward >= 0) {
        return reward.monthlyReward;
    }
    return partTimeMonthlyRewardTotal(
        reward.basicSalary,
        reward.commutingAllowance,
        partTimeOtherAllowanceTotal(reward),
    );
}
