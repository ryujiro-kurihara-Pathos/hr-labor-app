import { Timestamp } from 'firebase/firestore';

import {
    employeeDisplayStatusLabel,
    resolveEmployeeDisplayStatus,
} from './employee-status-display.util';

function dateTs(isoDate: string): Timestamp {
    return Timestamp.fromDate(new Date(isoDate));
}

describe('employee-status-display.util', () => {
    it('returns active for active employees', () => {
        expect(
            resolveEmployeeDisplayStatus({ status: 'active', retiredDate: null }),
        ).toBe('active');
        expect(employeeDisplayStatusLabel({ status: 'active', retiredDate: null })).toBe('在籍');
    });

    it('returns pending-retirement when retired date is today or later', () => {
        const future = new Date();
        future.setDate(future.getDate() + 7);
        const employee = { status: 'retired' as const, retiredDate: Timestamp.fromDate(future) };
        expect(resolveEmployeeDisplayStatus(employee)).toBe('pending-retirement');
        expect(employeeDisplayStatusLabel(employee)).toBe('退職予定');
    });

    it('returns retired when retired date has passed', () => {
        const employee = {
            status: 'retired' as const,
            retiredDate: dateTs('2020-01-01'),
        };
        expect(resolveEmployeeDisplayStatus(employee)).toBe('retired');
        expect(employeeDisplayStatusLabel(employee)).toBe('退職');
    });
});
