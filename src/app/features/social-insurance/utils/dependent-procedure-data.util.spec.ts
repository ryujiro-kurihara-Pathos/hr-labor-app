import { createEmptyEmployeeInput } from '../../employee/models/employee.models';
import {
    EMPTY_DEPENDENT_PROCEDURE_DATA,
    EMPTY_QUALIFICATION_PROCEDURE_DATA,
    Procedure,
} from '../models/procedures.model';
import { buildDependentProcedureDraftUpdate, generateMyNumber, resolveDependentFormMyNumber } from './dependent-procedure-data.util';

function procedure(overrides: Partial<Procedure> = {}): Procedure {
    return {
        id: 'p1',
        companyId: 'c1',
        officeId: 'o1',
        employeeId: 'e1',
        procedureType: 'dependentChange',
        status: 'notStarted',
        occurredDate: '',
        dueDate: '',
        completedDate: null,
        submittedDate: null,
        targetYearMonth: null,
        memo: '',
        lossReason: null,
        dependentChanges: null,
        createdAt: {} as Procedure['createdAt'],
        updatedAt: {} as Procedure['updatedAt'],
        ...EMPTY_QUALIFICATION_PROCEDURE_DATA,
        ...EMPTY_DEPENDENT_PROCEDURE_DATA,
        ...overrides,
    };
}

describe('buildDependentProcedureDraftUpdate', () => {
    it('saves change type and form fields as inProgress draft', () => {
        const updated = buildDependentProcedureDraftUpdate(procedure(), 'add', {
            changeDate: '',
            dependentId: '',
            lastName: '山田',
            firstName: '花子',
            birthDate: '2010-01-01',
            gender: 'female',
            relationship: 'child',
            myNumber: '',
            address: '東京都',
            occupation: '学生',
            income: '',
            isDisabled: false,
            dependencyStartDate: '2026-06-01',
            addReason: 'birth',
            addReasonNote: '',
            dependencyEndDate: '',
            deleteReason: '',
        });

        expect(updated.status).toBe('inProgress');
        expect(updated.dependentChanges).toBe('add');
        expect(updated.dependentLastName).toBe('山田');
        expect(updated.dependentFirstName).toBe('花子');
        expect(updated.dependencyStartDate).toBe('2026-06-01');
        expect(updated.dependentAddReason).toBe('birth');
        expect(updated.occurredDate).toBe('2026-06-01');
    });

    it('keeps delete-specific fields only for delete type', () => {
        const updated = buildDependentProcedureDraftUpdate(procedure(), 'delete', {
            changeDate: '',
            dependentId: 'd1',
            lastName: '',
            firstName: '',
            birthDate: '',
            gender: '',
            relationship: '',
            myNumber: '',
            address: '',
            occupation: '',
            income: '',
            isDisabled: false,
            dependencyStartDate: '2020-01-01',
            addReason: 'birth',
            addReasonNote: '',
            dependencyEndDate: '2026-06-15',
            deleteReason: 'employment',
        });

        expect(updated.dependentChanges).toBe('delete');
        expect(updated.dependencyStartDate).toBe('');
        expect(updated.dependentAddReason).toBe('');
        expect(updated.dependencyEndDate).toBe('2026-06-15');
        expect(updated.dependentDeleteReason).toBe('employment');
    });
});

describe('resolveDependentFormMyNumber', () => {
    it('returns existing number when registered', () => {
        expect(resolveDependentFormMyNumber('123456789012')).toBe('123456789012');
    });

    it('generates 12-digit number when empty', () => {
        const generated = resolveDependentFormMyNumber('');
        expect(generated).toMatch(/^\d{12}$/);
    });
});
