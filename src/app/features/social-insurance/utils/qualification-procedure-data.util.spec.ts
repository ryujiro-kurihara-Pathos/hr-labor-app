import {
    canAutoManageQualificationProcedure,
    hasJoinDateChanged,
    isQualificationDateDerivedFromJoinDate,
    qualificationProcedureDueDate,
    resolveEffectiveHealthInsuranceStartDateForSync,
    resolveLiveQualificationDisplayDate,
    resolveQualificationDateAfterJoinDateChange,
    resolveQualificationProcedureDates,
    shouldSyncQualificationProcedureDates,
    shouldUpdateInsuranceStartDatesFromJoinDate,
} from './qualification-procedure-data.util';
import { Employee } from '../../employee/models/employee.models';
import { Procedure } from '../models/procedures.model';

describe('qualification-procedure-data.util sync helpers', () => {
    const employee = {
        id: 'e1',
        companyId: 'c1',
        officeId: 'o1',
        joinedDate: '2026-04-01',
    } as Employee;

    const procedure = {
        qualificationDate: '2026-04-01',
        occurredDate: '2026-04-01',
        status: 'notStarted',
    } as Procedure;

    it('resolves dates from joined date when health insurance start date is unset', () => {
        expect(resolveQualificationProcedureDates(employee, null)).toEqual({
            qualificationDate: '2026-04-01',
            occurredDate: '2026-04-01',
            dueDate: qualificationProcedureDueDate('2026-04-01'),
        });
    });

    it('prefers registered health insurance start date', () => {
        expect(resolveQualificationProcedureDates(employee, '2026-04-15')).toEqual({
            qualificationDate: '2026-04-15',
            occurredDate: '2026-04-15',
            dueDate: qualificationProcedureDueDate('2026-04-15'),
        });
    });

    it('detects join date changes', () => {
        expect(hasJoinDateChanged('2026-04-01', '2026-04-10')).toBe(true);
        expect(hasJoinDateChanged('', '2026-04-01')).toBe(true);
        expect(hasJoinDateChanged('2026-04-01', '2026-04-01')).toBe(false);
    });

    it('allows auto manage unless both insurances are inactive', () => {
        expect(canAutoManageQualificationProcedure('unknown', 'unknown')).toBe(true);
        expect(canAutoManageQualificationProcedure('active', 'active')).toBe(true);
        expect(canAutoManageQualificationProcedure('inactive', 'active')).toBe(false);
    });

    it('syncs incomplete procedures when join date is set or changed', () => {
        expect(
            shouldSyncQualificationProcedureDates('notStarted', null, {
                previousJoinedDate: '',
                newJoinedDate: '2026-04-01',
                procedure,
            }),
        ).toBe(true);
        expect(
            shouldSyncQualificationProcedureDates('inProgress', '2026-04-15', {
                previousJoinedDate: '2026-04-01',
                newJoinedDate: '2026-04-10',
                procedure,
            }),
        ).toBe(true);
    });

    it('does not sync completed procedures or unchanged join dates', () => {
        expect(
            shouldSyncQualificationProcedureDates('completed', '2026-04-01', {
                previousJoinedDate: '2026-04-01',
                newJoinedDate: '2026-04-10',
                procedure,
            }),
        ).toBe(false);
        expect(
            shouldSyncQualificationProcedureDates('inProgress', '2026-04-01', {
                previousJoinedDate: '2026-04-01',
                newJoinedDate: '2026-04-01',
                procedure,
            }),
        ).toBe(false);
    });

    it('uses join date for sync when start date matches previous join date', () => {
        expect(
            resolveEffectiveHealthInsuranceStartDateForSync(
                employee,
                '2026-04-01',
                '2026-04-01',
                procedure,
            ),
        ).toBeNull();
        expect(
            resolveQualificationProcedureDates(
                { ...employee, joinedDate: '2026-04-10' },
                resolveEffectiveHealthInsuranceStartDateForSync(
                    { ...employee, joinedDate: '2026-04-10' },
                    '2026-04-01',
                    '2026-04-01',
                    { ...procedure, status: 'inProgress' },
                ),
            ),
        ).toEqual({
            qualificationDate: '2026-04-10',
            occurredDate: '2026-04-10',
            dueDate: qualificationProcedureDueDate('2026-04-10'),
        });
    });

    it('shows join date on live display for incomplete procedures', () => {
        expect(
            resolveLiveQualificationDisplayDate(
                { ...employee, joinedDate: '2026-04-10' },
                '2026-04-01',
                { ...procedure, status: 'inProgress' },
            ),
        ).toBe('2026-04-10');
    });

    it('keeps saved qualification date on live display for completed procedures', () => {
        expect(
            resolveLiveQualificationDisplayDate(
                { ...employee, joinedDate: '2026-04-10' },
                '2026-04-01',
                { ...procedure, status: 'completed' },
            ),
        ).toBe('2026-04-01');
    });

    it('updates insurance start dates when join date changes', () => {
        expect(
            shouldUpdateInsuranceStartDatesFromJoinDate(
                '2026-04-01',
                '2026-04-10',
                null,
                null,
                { status: 'notStarted' },
            ),
        ).toBe(true);
        expect(
            shouldUpdateInsuranceStartDatesFromJoinDate(
                '2026-04-01',
                '2026-04-10',
                null,
                null,
                { status: 'completed' },
            ),
        ).toBe(false);
    });

    it('resolves qualification date after join date change for persistence', () => {
        expect(
            resolveQualificationDateAfterJoinDateChange(
                { ...employee, joinedDate: '2026-04-10' },
                '2026-04-01',
                { status: 'notStarted' },
            ),
        ).toBe('2026-04-10');
        expect(
            resolveQualificationDateAfterJoinDateChange(
                { ...employee, joinedDate: '2026-04-10' },
                '2026-04-01',
                { status: 'completed' },
            ),
        ).toBeNull();
    });

    it('detects join-derived qualification dates', () => {
        expect(
            isQualificationDateDerivedFromJoinDate('2026-04-01', '2026-04-01', procedure),
        ).toBe(true);
        expect(
            isQualificationDateDerivedFromJoinDate('2026-04-15', '2026-04-01', procedure),
        ).toBe(false);
    });
});
