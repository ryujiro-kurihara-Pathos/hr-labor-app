import {
    canSubmitRegularDecisionProcedure,
    isRegularDecisionProcedureSubmissionAllowed,
    procedureDueDateFromOccurredDate,
    qualificationProcedureDueDate,
    regularDecisionProcedureDueDate,
    regularDecisionProcedureSubmissionStartDate,
    resolveDependentChangeOccurredAndDueDate,
    resolveLossProcedureOccurredAndDueDate,
} from './procedure-due-date.util';

describe('procedure-due-date.util', () => {
    it('sets submission deadline to 5 days after occurred date', () => {
        expect(procedureDueDateFromOccurredDate('2026-04-01')).toBe('2026-04-06');
        expect(qualificationProcedureDueDate('2026-04-15')).toBe('2026-04-20');
    });

    it('sets regular decision deadline to July 10 of determination year', () => {
        expect(regularDecisionProcedureDueDate(2026)).toBe('2026-07-10');
        expect(regularDecisionProcedureDueDate('2026-06')).toBe('2026-07-10');
    });

    it('sets regular decision submission start to July 1 of determination year', () => {
        expect(regularDecisionProcedureSubmissionStartDate(2026)).toBe('2026-07-01');
        expect(regularDecisionProcedureSubmissionStartDate('2026-06')).toBe('2026-07-01');
    });

    it('allows regular decision submission only between July 1 and July 10', () => {
        expect(isRegularDecisionProcedureSubmissionAllowed(2026, '2026-06-30')).toBeFalse();
        expect(isRegularDecisionProcedureSubmissionAllowed(2026, '2026-07-01')).toBeTrue();
        expect(isRegularDecisionProcedureSubmissionAllowed(2026, '2026-07-10')).toBeTrue();
        expect(isRegularDecisionProcedureSubmissionAllowed(2026, '2026-07-11')).toBeFalse();
    });

    it('allows late submission after the due date', () => {
        expect(canSubmitRegularDecisionProcedure(2026, '2026-07-05')).toBeTrue();
        expect(canSubmitRegularDecisionProcedure(2026, '2026-07-11')).toBeTrue();
        expect(canSubmitRegularDecisionProcedure(2026, '2026-12-31')).toBeTrue();
        expect(canSubmitRegularDecisionProcedure(2025, '2026-06-01')).toBeTrue();
    });

    it('blocks submission before the submission period starts', () => {
        expect(canSubmitRegularDecisionProcedure(2026, '2026-06-30')).toBeFalse();
        expect(canSubmitRegularDecisionProcedure(2026, '2026-04-01')).toBeFalse();
    });

    it('uses loss date for loss procedure deadline', () => {
        expect(
            resolveLossProcedureOccurredAndDueDate({
                retirementDate: '2026-04-15',
                lossReason: 'retirement',
            }),
        ).toEqual({
            occurredDate: '2026-04-16',
            dueDate: '2026-04-21',
        });
    });

    it('prefers registered health insurance end date for loss procedure', () => {
        expect(
            resolveLossProcedureOccurredAndDueDate({
                healthInsuranceEndDate: '2026-05-01',
                retirementDate: '2026-04-15',
                lossReason: 'retirement',
            }),
        ).toEqual({
            occurredDate: '2026-05-01',
            dueDate: '2026-05-06',
        });
    });

    it('resolves dependent change dates from start or end date', () => {
        expect(
            resolveDependentChangeOccurredAndDueDate({
                changeType: 'add',
                dependencyStartDate: '2026-06-01',
            }),
        ).toEqual({
            occurredDate: '2026-06-01',
            dueDate: '2026-06-06',
        });
        expect(
            resolveDependentChangeOccurredAndDueDate({
                changeType: 'delete',
                dependencyEndDate: '2026-08-20',
            }),
        ).toEqual({
            occurredDate: '2026-08-20',
            dueDate: '2026-08-25',
        });
    });

    it('resolves dependent change dates from change date for change type', () => {
        expect(
            resolveDependentChangeOccurredAndDueDate({
                changeType: 'change',
                changeDate: '2026-07-01',
                dependencyStartDate: '2026-01-01',
            }),
        ).toEqual({
            occurredDate: '2026-07-01',
            dueDate: '2026-07-06',
        });
    });
});
