import { isRegularDecisionProcedureRequiredForBaseYear } from './standard-remuneration-determination.util';

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
