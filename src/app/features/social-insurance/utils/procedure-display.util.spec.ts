import { canDeleteProcedure } from './procedure-display.util';

describe('procedure-display.util', () => {
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
