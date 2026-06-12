import { Employee } from '../models/employee.models';

export type EmployeeDisplayStatus = 'active' | 'pending-retirement' | 'retired';

export type EmployeeStatusFilter = '' | EmployeeDisplayStatus;

const LABELS: Record<EmployeeDisplayStatus, string> = {
    active: '在籍',
    'pending-retirement': '退職予定',
    retired: '退職',
};

function startOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
}

export function resolveEmployeeDisplayStatus(
    employee: Pick<Employee, 'status' | 'retiredDate'>,
): EmployeeDisplayStatus {
    if (employee.status === 'active') return 'active';
    if (!employee.retiredDate) return 'retired';

    const retired = startOfDay(employee.retiredDate.toDate());
    const today = startOfDay(new Date());
    return retired >= today ? 'pending-retirement' : 'retired';
}

export function employeeDisplayStatusLabel(
    employee: Pick<Employee, 'status' | 'retiredDate'>,
): string {
    return LABELS[resolveEmployeeDisplayStatus(employee)];
}

export function isEmployeePendingRetirement(
    employee: Pick<Employee, 'status' | 'retiredDate'>,
): boolean {
    return resolveEmployeeDisplayStatus(employee) === 'pending-retirement';
}

export function isEmployeeFullyRetired(
    employee: Pick<Employee, 'status' | 'retiredDate'>,
): boolean {
    return resolveEmployeeDisplayStatus(employee) === 'retired';
}

export function matchesEmployeeStatusFilter(
    employee: Pick<Employee, 'status' | 'retiredDate'>,
    filter: EmployeeStatusFilter,
): boolean {
    if (!filter) return true;
    return resolveEmployeeDisplayStatus(employee) === filter;
}
