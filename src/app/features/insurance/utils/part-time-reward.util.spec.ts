import {
    partTimeInsuranceMonthlyRewardFromRecord,
    partTimeMonthlyRewardTotal,
    partTimeOtherAllowanceTotal,
} from './part-time-reward.util';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';

describe('part-time-reward.util', () => {
    it('sums basic salary, commuting, and other allowance for monthly reward', () => {
        expect(partTimeMonthlyRewardTotal(80_000, 10_000, 5_000)).toBe(95_000);
    });

    it('reads monthly reward from saved record', () => {
        const reward = {
            basicSalary: 80_000,
            commutingAllowance: 10_000,
            otherFixedAllowance: 5_000,
            overtimePay: 0,
            holidayPay: 0,
            nightPay: 0,
            commissionPay: 0,
            otherVariablePay: 0,
            monthlyReward: 95_000,
        } as StandardMonthlyReward;

        expect(partTimeInsuranceMonthlyRewardFromRecord(reward)).toBe(95_000);
    });

    it('aggregates legacy variable pay into other allowance total', () => {
        expect(
            partTimeOtherAllowanceTotal({
                otherFixedAllowance: 3_000,
                overtimePay: 2_000,
                holidayPay: 0,
                nightPay: 0,
                commissionPay: 0,
                otherVariablePay: 0,
            }),
        ).toBe(5_000);
    });
});
