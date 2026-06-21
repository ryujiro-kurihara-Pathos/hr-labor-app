import {
    getRegularDeterminationRewardMonths,
    isRegularDecisionProcedureRequiredForBaseYear,
    mapRegularPaymentMonthToRewardMonth,
} from './standard-remuneration-determination.util';

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
