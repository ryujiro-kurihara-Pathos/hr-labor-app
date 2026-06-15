import {
    canAutoManageQualificationProcedure,
    qualificationProcedureDueDate,
    resolveQualificationProcedureDates,
    shouldSyncQualificationProcedureDates,
} from './qualification-procedure-data.util';
import { Employee } from '../../employee/models/employee.models';

describe('qualification-procedure-data.util sync helpers', () => {
    const employee = {
        id: 'e1',
        companyId: 'c1',
        officeId: 'o1',
        joinedDate: '2026-04-01',
    } as Employee;

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

    it('allows auto manage unless both insurances are inactive', () => {
        expect(canAutoManageQualificationProcedure('unknown', 'unknown')).toBe(true);
        expect(canAutoManageQualificationProcedure('active', 'active')).toBe(true);
        expect(canAutoManageQualificationProcedure('inactive', 'active')).toBe(false);
    });

    it('syncs only incomplete procedures without registered start date', () => {
        expect(shouldSyncQualificationProcedureDates('notStarted', null)).toBe(true);
        expect(shouldSyncQualificationProcedureDates('completed', null)).toBe(false);
        expect(shouldSyncQualificationProcedureDates('inProgress', '2026-04-01')).toBe(false);
    });
});
