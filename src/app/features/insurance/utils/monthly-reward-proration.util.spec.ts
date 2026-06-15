import {
    getDaysInMonth,
    resolveMonthlyRewardWithEnrollmentProration,
    shouldProrateMonthlyRewardByPaymentBaseDays,
} from './monthly-reward-proration.util';

describe('monthly-reward-proration.util', () => {
    it('does not prorate part-time monthly reward by payment base days', () => {
        expect(shouldProrateMonthlyRewardByPaymentBaseDays('part-time')).toBeFalse();
        expect(
            resolveMonthlyRewardWithEnrollmentProration({
                employmentType: 'part-time',
                monthlyReward: 88_000,
                paymentBaseDays: 10,
                daysInMonth: 30,
            }),
        ).toBe(88_000);
    });

    it('prorates full-time monthly reward when enrolled for part of the month', () => {
        expect(shouldProrateMonthlyRewardByPaymentBaseDays('full-time')).toBeTrue();
        expect(
            resolveMonthlyRewardWithEnrollmentProration({
                employmentType: 'full-time',
                monthlyReward: 300_000,
                paymentBaseDays: 15,
                daysInMonth: 30,
            }),
        ).toBe(150_000);
    });

    it('returns full monthly reward when enrolled for the entire month', () => {
        expect(
            resolveMonthlyRewardWithEnrollmentProration({
                employmentType: 'full-time',
                monthlyReward: 300_000,
                paymentBaseDays: getDaysInMonth('2026-04'),
                daysInMonth: getDaysInMonth('2026-04'),
            }),
        ).toBe(300_000);
    });
});
