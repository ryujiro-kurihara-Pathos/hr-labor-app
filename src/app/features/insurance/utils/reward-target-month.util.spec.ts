import { Timestamp } from 'firebase/firestore';

import { createEmptyEmployeeInput, Employee } from '../../employee/models/employee.models';
import {
    bonusPaymentDateReason,
    isBonusPaymentDateAllowed,
    isDateWithinEmploymentPeriod,
    isRewardTargetMonth,
} from './reward-target-month.util';

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

        it('excludes months after retirement month', () => {
            const retired = employee({
                retiredDate: Timestamp.fromDate(new Date(2026, 5, 30)),
            });
            expect(isRewardTargetMonth(retired, '2026-06')).toBeTrue();
            expect(isRewardTargetMonth(retired, '2026-07')).toBeFalse();
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
    });
});
