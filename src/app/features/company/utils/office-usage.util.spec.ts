import {
    buildOfficeDeletionCheck,
    filterActiveOffices,
    officeDeletionBlockedMessage,
} from './office-usage.util';
import { Office } from '../models/office.model';

describe('office-usage.util', () => {
    const offices: Office[] = [
        {
            id: '1',
            companyId: 'c1',
            name: '本社',
            postalCode: '',
            prefecture: '東京都',
            city: '',
            streetAddress: '',
            buildingName: '',
            phoneNumber: '',
            healthInsuranceType: 'kyokai',
            officeSymbol: '00-アアア',
            officeNumber: '12345',
            regularWeeklyScheduledWorkHours: null,
            regularMonthlyScheduledWorkHours: null,
            regularWeeklyScheduledWorkDays: null,
            regularMonthlyScheduledWorkDays: null,
            status: 'active',
            createdAt: {} as Office['createdAt'],
            updatedAt: {} as Office['updatedAt'],
        },
        {
            id: '2',
            companyId: 'c1',
            name: '旧支店',
            postalCode: '',
            prefecture: '大阪府',
            city: '',
            streetAddress: '',
            buildingName: '',
            phoneNumber: '',
            healthInsuranceType: 'kyokai',
            officeSymbol: '00-イイイ',
            officeNumber: '54321',
            regularWeeklyScheduledWorkHours: null,
            regularMonthlyScheduledWorkHours: null,
            regularWeeklyScheduledWorkDays: null,
            regularMonthlyScheduledWorkDays: null,
            status: 'disabled',
            createdAt: {} as Office['createdAt'],
            updatedAt: {} as Office['updatedAt'],
        },
    ];

    it('filters active offices only', () => {
        expect(filterActiveOffices(offices).map((office) => office.id)).toEqual(['1']);
    });

    it('allows deletion when no business data is linked', () => {
        const check = buildOfficeDeletionCheck({ employeeCount: 0, procedureCount: 0 });
        expect(check.canDelete).toBeTrue();
        expect(officeDeletionBlockedMessage(check)).toBe('');
    });

    it('blocks deletion when employees are linked', () => {
        const check = buildOfficeDeletionCheck({ employeeCount: 2, procedureCount: 0 });
        expect(check.canDelete).toBeFalse();
        expect(officeDeletionBlockedMessage(check)).toContain('従業員 2 名');
    });

    it('blocks deletion when procedures are linked', () => {
        const check = buildOfficeDeletionCheck({ employeeCount: 0, procedureCount: 1 });
        expect(check.canDelete).toBeFalse();
        expect(officeDeletionBlockedMessage(check)).toContain('届出手続き 1 件');
    });
});
