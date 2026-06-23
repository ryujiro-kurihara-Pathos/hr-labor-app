import { Timestamp } from 'firebase/firestore';

import { createEmptyEmployeeInput, Employee } from '../../employee/models/employee.models';
import {
    bonusPaymentDateReason,
    inputableYearMonthMax,
    insuranceRatePremiumDeductYearMonthMax,
    isBonusPaymentDateAllowed,
    isBonusPaymentDatePremiumable,
    isDateWithinEmploymentPeriod,
    isPremiumViewableYearMonth,
    isRewardTargetMonth,
    listNavigableYearMonthMax,
    premiumViewableYearMonthMax,
} from './reward-target-month.util';
import { AUTOMATIC_INSURANCE_RATE_AVAILABLE_TO } from './insurance-premium-rate-resolution.util';

function employee(overrides: Partial<ReturnType<typeof createEmptyEmployeeInput>> = {}): Employee {
    return {
        id: 'e1',
        ...createEmptyEmployeeInput({
            joinedDate: '2026-04-15',
            ...overrides,
        }),
        createdAt: {} as Employee['createdAt'],
        updatedAt: {} as Employee['updatedAt'],
    };
}

describe('reward-target-month.util', () => {
    describe('isRewardTargetMonth', () => {
        it('excludes months before join month', () => {
            expect(isRewardTargetMonth(employee(), '2026-03')).toBeFalse();
            expect(isRewardTargetMonth(employee(), '2026-04')).toBeTrue();
        });

        it('allows input through month after retirement and blocks after that', () => {
            const retired = employee({
                retiredDate: Timestamp.fromDate(new Date(2026, 5, 30)),
            });
            expect(isRewardTargetMonth(retired, '2026-06', '2026-06')).toBeTrue();
            expect(isRewardTargetMonth(retired, '2026-07', '2026-06')).toBeTrue();
            expect(isRewardTargetMonth(retired, '2026-08', '2026-06')).toBeFalse();
        });

        it('allows current month and next month only', () => {
            const ref = '2026-06';
            expect(isRewardTargetMonth(employee(), '2026-06', ref)).toBeTrue();
            expect(isRewardTargetMonth(employee(), '2026-07', ref)).toBeTrue();
            expect(isRewardTargetMonth(employee(), '2026-08', ref)).toBeFalse();
        });

        it('caps at month after retirement when earlier than reference next month', () => {
            const retired = employee({
                retiredDate: Timestamp.fromDate(new Date(2026, 5, 30)),
            });
            const ref = '2026-06';
            expect(isRewardTargetMonth(retired, '2026-06', ref)).toBeTrue();
            expect(isRewardTargetMonth(retired, '2026-07', ref)).toBeTrue();
            expect(isRewardTargetMonth(retired, '2026-08', ref)).toBeFalse();
        });
    });

    describe('inputableYearMonthMax', () => {
        it('returns next month when no retirement date', () => {
            expect(inputableYearMonthMax(employee(), '2026-06')).toBe('2026-07');
        });

        it('returns month after retirement when earlier than reference next month', () => {
            const retired = employee({
                retiredDate: Timestamp.fromDate(new Date(2026, 5, 30)),
            });
            expect(inputableYearMonthMax(retired, '2026-06')).toBe('2026-07');
        });

        it('caps at automatic insurance rate coverage end', () => {
            expect(inputableYearMonthMax(employee(), '2027-02')).toBe(AUTOMATIC_INSURANCE_RATE_AVAILABLE_TO);
            expect(inputableYearMonthMax(employee(), '2027-01')).toBe('2027-02');
        });
    });

    describe('listNavigableYearMonthMax', () => {
        it('caps at rate data end when reference is near fiscal year end', () => {
            expect(listNavigableYearMonthMax('2027-01')).toBe('2027-02');
            expect(listNavigableYearMonthMax('2027-02')).toBe('2027-02');
        });
    });

    describe('insuranceRatePremiumDeductYearMonthMax', () => {
        it('extends one month for next_month collection', () => {
            expect(insuranceRatePremiumDeductYearMonthMax('same_month')).toBe('2027-02');
            expect(insuranceRatePremiumDeductYearMonthMax('next_month')).toBe('2027-03');
        });
    });

    describe('premiumViewableYearMonthMax', () => {
        it('matches input max for same_month collection', () => {
            const ref = '2026-04';
            expect(premiumViewableYearMonthMax(employee(), ref, 'same_month')).toBe('2026-05');
        });

        it('extends one month beyond input max for next_month collection', () => {
            const ref = '2026-04';
            expect(inputableYearMonthMax(employee(), ref)).toBe('2026-05');
            expect(premiumViewableYearMonthMax(employee(), ref, 'next_month')).toBe('2026-06');
        });

        it('caps premium view at loss-date-based deduct month for next_month collection', () => {
            const retired = employee({
                retiredDate: Timestamp.fromDate(new Date(2026, 5, 15)),
            });
            const ref = '2026-06';
            expect(premiumViewableYearMonthMax(retired, ref, 'next_month')).toBe('2026-06');
        });

        it('caps at month after retirement for end-of-month retirement under next_month collection', () => {
            const retired = employee({
                retiredDate: Timestamp.fromDate(new Date(2026, 4, 31)),
            });
            const ref = '2026-04';
            expect(premiumViewableYearMonthMax(retired, ref, 'next_month')).toBe('2026-06');
        });

        it('extends to latest confirmed work month + 1 under next_month collection', () => {
            const ref = '2025-07';
            expect(premiumViewableYearMonthMax(employee(), ref, 'next_month')).toBe('2025-09');
            expect(
                premiumViewableYearMonthMax(employee(), ref, 'next_month', '2025-09'),
            ).toBe('2025-10');
        });
    });

    describe('isPremiumViewableYearMonth', () => {
        it('allows premium-only month under next_month collection', () => {
            const ref = '2026-04';
            expect(isRewardTargetMonth(employee(), '2026-06', ref)).toBeFalse();
            expect(isPremiumViewableYearMonth(employee(), '2026-06', ref, 'next_month')).toBeTrue();
        });

        it('does not allow premium-only month under same_month collection', () => {
            const ref = '2026-04';
            expect(isPremiumViewableYearMonth(employee(), '2026-06', ref, 'same_month')).toBeFalse();
        });
    });

    describe('isDateWithinEmploymentPeriod', () => {
        it('excludes dates before join date within join month', () => {
            expect(isDateWithinEmploymentPeriod(employee(), '2026-04-14')).toBeFalse();
            expect(isDateWithinEmploymentPeriod(employee(), '2026-04-15')).toBeTrue();
        });

        it('excludes dates after retirement date within retirement month', () => {
            const retired = employee({
                retiredDate: Timestamp.fromDate(new Date(2026, 5, 10)),
            });
            expect(isDateWithinEmploymentPeriod(retired, '2026-06-10')).toBeTrue();
            expect(isDateWithinEmploymentPeriod(retired, '2026-06-11')).toBeFalse();
        });
    });

    describe('isBonusPaymentDateAllowed', () => {
        it('requires payment date within insured period and target month', () => {
            expect(isBonusPaymentDateAllowed(employee(), '2026-04-20')).toBeTrue();
            expect(isBonusPaymentDateAllowed(employee(), '2026-03-20')).toBeFalse();
            expect(isBonusPaymentDateAllowed(employee(), '2026-04-01')).toBeFalse();
        });

        it('returns reason for out-of-period bonus date', () => {
            expect(bonusPaymentDateReason(employee(), '2026-04-01')).toContain('資格取得日');
        });

        it('allows bonus input after loss date in month after retirement but excludes premium', () => {
            const retired = employee({
                retiredDate: Timestamp.fromDate(new Date(2026, 5, 30)),
            });
            expect(isBonusPaymentDateAllowed(retired, '2026-07-15')).toBeTrue();
            expect(isBonusPaymentDatePremiumable(retired, '2026-07-15')).toBeFalse();
            expect(isBonusPaymentDatePremiumable(retired, '2026-06-30')).toBeTrue();
        });
    });
});
