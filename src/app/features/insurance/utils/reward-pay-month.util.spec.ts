import { Employee } from '../../employee/models/employee.models';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import {
    isJoinMonthWithNextMonthPay,
    isJoinMonthZeroPremiumDeductionView,
    isJoinPayMonthView,
    isPremiumBasisRewardConfirmed,
    isRewardConfirmedForPayMonth,
    lookupQualificationInitialReward,
    lookupRewardByPayMonth,
    resolvePremiumBasisRewardPayYearMonth,
    resolveQualificationRewardPayYearMonth,
    rewardLookupKeysForPayMonth,
} from './reward-pay-month.util';

function employee(joinedDate: string): Employee {
    return {
        id: 'emp-1',
        joinedDate,
    } as Employee;
}

function reward(ym: string, status: 'draft' | 'confirmed' = 'confirmed'): StandardMonthlyReward {
    return {
        id: `emp-1_${ym}`,
        targetYearMonth: ym,
        status,
    } as StandardMonthlyReward;
}

describe('reward-pay-month.util', () => {
    describe('isJoinPayMonthView', () => {
        it('returns true when pay month equals join month', () => {
            expect(isJoinPayMonthView(employee('2026-02-15'), '2026-02')).toBe(true);
        });
    });

    describe('isJoinMonthWithNextMonthPay', () => {
        it('returns true for join month with next month payment', () => {
            expect(isJoinMonthWithNextMonthPay(employee('2026-02-15'), '2026-02', 1)).toBe(true);
        });

        it('returns false for same month payment', () => {
            expect(isJoinMonthWithNextMonthPay(employee('2026-02-15'), '2026-02', 0)).toBe(false);
        });
    });

    describe('isJoinMonthZeroPremiumDeductionView', () => {
        it('returns true for join month with next month collection', () => {
            expect(
                isJoinMonthZeroPremiumDeductionView(employee('2026-02-15'), '2026-02', 'next_month'),
            ).toBe(true);
        });

        it('returns false for same month collection', () => {
            expect(
                isJoinMonthZeroPremiumDeductionView(employee('2026-02-15'), '2026-02', 'same_month'),
            ).toBe(false);
        });
    });

    describe('rewardLookupKeysForPayMonth', () => {
        it('skips join month fallback for first pay month after join', () => {
            expect(rewardLookupKeysForPayMonth('2026-03', 1, '2026-02')).toEqual(['2026-03']);
        });

        it('includes work month fallback for later pay months', () => {
            expect(rewardLookupKeysForPayMonth('2026-04', 1, '2026-02')).toEqual(['2026-04', '2026-03']);
        });
    });

    describe('lookupRewardByPayMonth', () => {
        it('does not return join month qualification record for first pay month', () => {
            const rewards = {
                '2026-02': reward('2026-02', 'draft'),
            };
            expect(lookupRewardByPayMonth(rewards, '2026-03', 1, '2026-02')).toBeNull();
        });
    });

    describe('lookupQualificationInitialReward', () => {
        it('uses first pay month key for next month payment', () => {
            const rewards = {
                '2026-03': reward('2026-03'),
            };
            expect(
                lookupQualificationInitialReward(rewards, '2026-02', 1)?.targetYearMonth,
            ).toBe('2026-03');
        });

        it('falls back to join month key for legacy data', () => {
            const rewards = {
                '2026-02': reward('2026-02'),
            };
            expect(
                lookupQualificationInitialReward(rewards, '2026-02', 1)?.targetYearMonth,
            ).toBe('2026-02');
        });

        it('uses qualification month key for same month payment', () => {
            const rewards = {
                '2026-02': reward('2026-02'),
            };
            expect(
                lookupQualificationInitialReward(rewards, '2026-02', 0)?.targetYearMonth,
            ).toBe('2026-02');
        });
    });

    describe('resolveQualificationRewardPayYearMonth', () => {
        it('returns next month for next month payment', () => {
            expect(resolveQualificationRewardPayYearMonth('2026-02', 1)).toBe('2026-03');
        });
    });

    describe('isRewardConfirmedForPayMonth', () => {
        it('returns true only for exact pay month key', () => {
            const rewards = {
                '2026-03': reward('2026-03'),
            };
            expect(isRewardConfirmedForPayMonth(rewards, '2026-03', 1)).toBe(true);
            expect(isRewardConfirmedForPayMonth(rewards, '2026-04', 1)).toBe(false);
        });

        it('does not treat previous month confirmed record as current month confirmed', () => {
            const rewards = {
                '2026-03': reward('2026-03'),
            };
            expect(isRewardConfirmedForPayMonth(rewards, '2026-04', 1)).toBe(false);
        });
    });

    describe('resolvePremiumBasisRewardPayYearMonth', () => {
        it('uses deduction month for same_month collection', () => {
            expect(resolvePremiumBasisRewardPayYearMonth('2026-10', 'same_month')).toBe('2026-10');
        });

        it('uses previous month for next_month collection', () => {
            expect(resolvePremiumBasisRewardPayYearMonth('2026-10', 'next_month')).toBe('2026-09');
        });
    });

    describe('isPremiumBasisRewardConfirmed', () => {
        it('checks liability month reward for next_month collection', () => {
            const rewards = {
                '2026-09': reward('2026-09'),
            };
            expect(isPremiumBasisRewardConfirmed(rewards, '2026-10', 'next_month')).toBe(true);
            expect(isPremiumBasisRewardConfirmed(rewards, '2026-10', 'same_month')).toBe(false);
        });
    });
});
