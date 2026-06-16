import { Timestamp } from 'firebase/firestore';

import { Employee, EmployeeStatus } from '../models/employee.models';

export type EmployeeDisplayStatus =
    | 'before-join'
    | 'active'
    | 'pending-retirement'
    | 'retired';

export type EmployeeStatusFilter = '' | EmployeeDisplayStatus;

const LABELS: Record<EmployeeDisplayStatus, string> = {
    'before-join': '入社前',
    active: '在籍',
    'pending-retirement': '退職予定',
    retired: '退職済',
};

function startOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
}

function parseJoinedDate(joinedDate: string | null | undefined): Date | null {
    const value = joinedDate?.trim();
    if (!value) return null;
    const parsed = startOfDay(new Date(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveEmployeeDisplayStatus(
    employee: Pick<Employee, 'status' | 'retiredDate' | 'joinedDate'>,
    referenceDate: Date = new Date(),
): EmployeeDisplayStatus {
    const today = startOfDay(referenceDate);
    const joined = parseJoinedDate(employee.joinedDate);
    if (joined && joined > today) {
        return 'before-join';
    }

    if (employee.retiredDate) {
        const retired = startOfDay(employee.retiredDate.toDate());
        return retired >= today ? 'pending-retirement' : 'retired';
    }

    if (employee.status === 'retired') {
        return 'retired';
    }

    return 'active';
}

export function resolveEmployeeStoredStatus(
    employee: Pick<Employee, 'retiredDate' | 'joinedDate'>,
): EmployeeStatus {
    if (employee.retiredDate) return 'retired';
    return 'active';
}

export function employeeDisplayStatusLabel(
    employee: Pick<Employee, 'status' | 'retiredDate' | 'joinedDate'>,
    referenceDate?: Date,
): string {
    return LABELS[resolveEmployeeDisplayStatus(employee, referenceDate)];
}

export function isEmployeeBeforeJoin(
    employee: Pick<Employee, 'status' | 'retiredDate' | 'joinedDate'>,
    referenceDate?: Date,
): boolean {
    return resolveEmployeeDisplayStatus(employee, referenceDate) === 'before-join';
}

export function isEmployeeActive(
    employee: Pick<Employee, 'status' | 'retiredDate' | 'joinedDate'>,
    referenceDate?: Date,
): boolean {
    return resolveEmployeeDisplayStatus(employee, referenceDate) === 'active';
}

export function isEmployeePendingRetirement(
    employee: Pick<Employee, 'status' | 'retiredDate' | 'joinedDate'>,
    referenceDate?: Date,
): boolean {
    return resolveEmployeeDisplayStatus(employee, referenceDate) === 'pending-retirement';
}

export function isEmployeeFullyRetired(
    employee: Pick<Employee, 'status' | 'retiredDate' | 'joinedDate'>,
    referenceDate?: Date,
): boolean {
    return resolveEmployeeDisplayStatus(employee, referenceDate) === 'retired';
}

export function matchesEmployeeStatusFilter(
    employee: Pick<Employee, 'status' | 'retiredDate' | 'joinedDate'>,
    filter: EmployeeStatusFilter,
    referenceDate?: Date,
): boolean {
    if (!filter) return true;
    return resolveEmployeeDisplayStatus(employee, referenceDate) === filter;
}

export function retiredDateFromInput(value: string): Timestamp | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return Timestamp.fromDate(parsed);
}
