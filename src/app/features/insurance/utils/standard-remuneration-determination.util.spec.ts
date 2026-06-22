import { Employee } from '../../employee/models/employee.models';
import {
    getPaymentBaseDays,
    getPaymentBaseDaysForPayMonth,
    getRegularCalculationMonths,
    getRegularDeterminationRewardMonths,
    isRegularDecisionProcedureRequiredForBaseYear,
    mapRegularPaymentMonthToRewardMonth,
    resolveWorkMonthForPaymentBaseDays,
} from './standard-remuneration-determination.util';

function employee(joinedDate: string): Employee {
    return {
        id: 'emp-1',
        joinedDate,
        retiredDate: null,
    } as Employee;
}

describe('getRegularDeterminationRewardMonths', () => {
    it('returns Apr-Jun reward keys for same-month payment', () => {
        expect(getRegularDeterminationRewardMonths(2026, 0)).toEqual([
            '2026-04',
            '2026-05',
            '2026-06',
        ]);
    });

    it('returns Apr-Jun reward keys for next-month payment', () => {
        expect(getRegularDeterminationRewardMonths(2026, 1)).toEqual([
            '2026-04',
            '2026-05',
            '2026-06',
        ]);
    });
});

describe('mapRegularPaymentMonthToRewardMonth', () => {
    it('maps April payment to April reward for next-month payment', () => {
        expect(mapRegularPaymentMonthToRewardMonth('2026-04', 1)).toBe('2026-04');
    });

    it('keeps April payment for same-month payment', () => {
        expect(mapRegularPaymentMonthToRewardMonth('2026-04', 0)).toBe('2026-04');
    });
});

describe('resolveWorkMonthForPaymentBaseDays', () => {
    it('returns previous month for next month payment', () => {
        expect(resolveWorkMonthForPaymentBaseDays('2026-04', 1)).toBe('2026-03');
    });

    it('returns same month for same month payment', () => {
        expect(resolveWorkMonthForPaymentBaseDays('2026-04', 0)).toBe('2026-04');
    });
});

describe('getPaymentBaseDaysForPayMonth', () => {
    it('uses work month days for next month payment', () => {
        const marchDays = getPaymentBaseDays('2026-03', '2024-04-01', null);
        const aprilPayDays = getPaymentBaseDaysForPayMonth('2026-04', '2024-04-01', null, 1);
        expect(aprilPayDays).toBe(marchDays);
    });
});

describe('getRegularCalculationMonths', () => {
    it('includes only pay months whose work month has 17+ enrolled days', () => {
        const months = getRegularCalculationMonths(
            employee('2024-04-01'),
            2026,
            '2024-04-01',
            1,
        );
        expect(months).toEqual(['2026-04', '2026-05', '2026-06']);
    });

    it('excludes pay month when work month has fewer than 17 days', () => {
        const months = getRegularCalculationMonths(
            employee('2026-04-20'),
            2026,
            '2026-04-20',
            1,
        );
        expect(months).not.toContain('2026-04');
        expect(months).not.toContain('2026-05');
        expect(months).toContain('2026-06');
    });

    it('includes additional pay months when short-time worker uses 11-day threshold', () => {
        const months17 = getRegularCalculationMonths(
            employee('2026-04-20'),
            2026,
            '2026-04-20',
            1,
        );
        const months11 = getRegularCalculationMonths(
            employee('2026-04-20'),
            2026,
            '2026-04-20',
            1,
            11,
        );
        expect(months17).toEqual(['2026-06']);
        expect(months11).toEqual(['2026-05', '2026-06']);
    });
});

describe('isRegularDecisionProcedureRequiredForBaseYear', () => {
    it('requires regular decision when qualified before June 1 in the same year', () => {
        expect(isRegularDecisionProcedureRequiredForBaseYear('2026-05-31', 2026)).toBeTrue();
    });

    it('does not require regular decision when qualified on or after June 1 in the same year', () => {
        expect(isRegularDecisionProcedureRequiredForBaseYear('2026-06-01', 2026)).toBeFalse();
        expect(isRegularDecisionProcedureRequiredForBaseYear('2026-08-15', 2026)).toBeFalse();
    });

    it('requires regular decision in later base years after a late-year qualification', () => {
        expect(isRegularDecisionProcedureRequiredForBaseYear('2026-06-15', 2027)).toBeTrue();
    });

    it('requires regular decision when qualified in an earlier year', () => {
        expect(isRegularDecisionProcedureRequiredForBaseYear('2024-04-01', 2026)).toBeTrue();
    });

    it('does not require regular decision before qualification year', () => {
        expect(isRegularDecisionProcedureRequiredForBaseYear('2026-06-15', 2025)).toBeFalse();
    });
});
