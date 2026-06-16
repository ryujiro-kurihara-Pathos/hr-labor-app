import { Timestamp } from 'firebase/firestore';

import {
    employeeDisplayStatusLabel,
    resolveEmployeeDisplayStatus,
    resolveEmployeeStoredStatus,
} from './employee-status-display.util';

function dateTs(isoDate: string): Timestamp {
    return Timestamp.fromDate(new Date(isoDate));
}

describe('employee-status-display.util', () => {
    it('returns before-join when joined date is in the future', () => {
        const future = new Date();
        future.setDate(future.getDate() + 14);
        const joinedDate = future.toISOString().slice(0, 10);
        const employee = { status: 'active' as const, retiredDate: null, joinedDate };
        expect(resolveEmployeeDisplayStatus(employee)).toBe('before-join');
        expect(employeeDisplayStatusLabel(employee)).toBe('入社前');
    });

    it('returns active for current employees', () => {
        const employee = {
            status: 'active' as const,
            retiredDate: null,
            joinedDate: '2020-01-01',
        };
        expect(resolveEmployeeDisplayStatus(employee)).toBe('active');
        expect(employeeDisplayStatusLabel(employee)).toBe('在籍');
    });

    it('returns pending-retirement when retired date is today or later', () => {
        const future = new Date();
        future.setDate(future.getDate() + 7);
        const employee = {
            status: 'retired' as const,
            retiredDate: Timestamp.fromDate(future),
            joinedDate: '2020-01-01',
        };
        expect(resolveEmployeeDisplayStatus(employee)).toBe('pending-retirement');
        expect(employeeDisplayStatusLabel(employee)).toBe('退職予定');
    });

    it('returns retired when retired date has passed', () => {
        const employee = {
            status: 'retired' as const,
            retiredDate: dateTs('2020-01-01'),
            joinedDate: '2019-01-01',
        };
        expect(resolveEmployeeDisplayStatus(employee)).toBe('retired');
        expect(employeeDisplayStatusLabel(employee)).toBe('退職済');
    });

    it('derives stored status from retirement date only', () => {
        expect(resolveEmployeeStoredStatus({ retiredDate: dateTs('2026-12-31'), joinedDate: '2020-01-01' })).toBe(
            'retired',
        );
        expect(resolveEmployeeStoredStatus({ retiredDate: null, joinedDate: '2020-01-01' })).toBe('active');
    });
});
