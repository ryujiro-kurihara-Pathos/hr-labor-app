import { canDeleteProcedure, formatProcedureNudgeDueOrSubmitted } from './procedure-display.util';

describe('procedure-display.util', () => {
    describe('formatProcedureNudgeDueOrSubmitted', () => {
        it('returns submitted label when completed', () => {
            expect(formatProcedureNudgeDueOrSubmitted('completed', '2026-07-10')).toBe('提出済');
        });

        it('returns due date label when not completed', () => {
            expect(formatProcedureNudgeDueOrSubmitted('inProgress', '2026-07-10')).toBe(
                '提出期限 2026/07/10',
            );
        });

        it('returns empty string when due date is missing and not completed', () => {
            expect(formatProcedureNudgeDueOrSubmitted('notStarted', '')).toBe('');
        });
    });

    describe('canDeleteProcedure', () => {
        it('allows deleting unsubmitted dependent change procedures', () => {
            expect(
                canDeleteProcedure({ procedureType: 'dependentChange', status: 'notStarted' }),
            ).toBeTrue();
            expect(
                canDeleteProcedure({ procedureType: 'dependentChange', status: 'inProgress' }),
            ).toBeTrue();
        });

        it('blocks deleting submitted dependent change procedures', () => {
            expect(
                canDeleteProcedure({ procedureType: 'dependentChange', status: 'completed' }),
            ).toBeFalse();
        });

        it('blocks deleting other procedure types even when unsubmitted', () => {
            expect(
                canDeleteProcedure({ procedureType: 'qualification', status: 'notStarted' }),
            ).toBeFalse();
            expect(
                canDeleteProcedure({ procedureType: 'loss', status: 'inProgress' }),
            ).toBeFalse();
        });
    });
});
