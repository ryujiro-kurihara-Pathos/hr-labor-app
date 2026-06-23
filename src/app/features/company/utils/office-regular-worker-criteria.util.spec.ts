import {
    parseRegularMonthlyScheduledWorkDays,
    parseRegularWeeklyScheduledWorkHours,
    validateOfficeRegularWorkerCriteria,
} from './office-regular-worker-criteria.util';

describe('office-regular-worker-criteria.util', () => {
    describe('parseRegularWeeklyScheduledWorkHours', () => {
        it('allows empty input as null', () => {
            expect(parseRegularWeeklyScheduledWorkHours('')).toEqual({ ok: true, value: null });
            expect(parseRegularWeeklyScheduledWorkHours('   ')).toEqual({ ok: true, value: null });
        });

        it('allows positive decimals', () => {
            expect(parseRegularWeeklyScheduledWorkHours('40')).toEqual({ ok: true, value: 40 });
            expect(parseRegularWeeklyScheduledWorkHours('38.5')).toEqual({ ok: true, value: 38.5 });
        });

        it('rejects zero, negative, and non-numeric values', () => {
            expect(parseRegularWeeklyScheduledWorkHours('0').ok).toBeFalse();
            expect(parseRegularWeeklyScheduledWorkHours('-1').ok).toBeFalse();
            expect(parseRegularWeeklyScheduledWorkHours('abc').ok).toBeFalse();
        });
    });

    describe('parseRegularMonthlyScheduledWorkDays', () => {
        it('allows empty input as null', () => {
            expect(parseRegularMonthlyScheduledWorkDays('')).toEqual({ ok: true, value: null });
        });

        it('allows positive integers only', () => {
            expect(parseRegularMonthlyScheduledWorkDays('20')).toEqual({ ok: true, value: 20 });
        });

        it('rejects decimals, zero, negative, and non-numeric values', () => {
            expect(parseRegularMonthlyScheduledWorkDays('20.5').ok).toBeFalse();
            expect(parseRegularMonthlyScheduledWorkDays('0').ok).toBeFalse();
            expect(parseRegularMonthlyScheduledWorkDays('-3').ok).toBeFalse();
            expect(parseRegularMonthlyScheduledWorkDays('abc').ok).toBeFalse();
        });
    });

    describe('validateOfficeRegularWorkerCriteria', () => {
        it('returns parsed values when both fields are valid', () => {
            expect(validateOfficeRegularWorkerCriteria('38.5', '20')).toEqual({
                ok: true,
                value: {
                    regularWeeklyScheduledWorkHours: 38.5,
                    regularMonthlyScheduledWorkDays: 20,
                },
            });
        });

        it('returns the first validation error', () => {
            expect(validateOfficeRegularWorkerCriteria('0', '20.5').ok).toBeFalse();
            expect(validateOfficeRegularWorkerCriteria('40', '20.5')).toEqual({
                ok: false,
                error: '月の所定労働日数は整数で入力してください',
            });
        });
    });
});
