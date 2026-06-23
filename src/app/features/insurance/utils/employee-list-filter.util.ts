import { Employee } from '../../employee/models/employee.models';

export function matchesEmployeeListSearch(employee: Employee, keyword: string): boolean {
    const query = keyword.trim().toLowerCase();
    if (!query) return true;

    return (
        `${employee.lastName}${employee.firstName}`.toLowerCase().includes(query)
        || `${employee.lastNameKana ?? ''}${employee.firstNameKana ?? ''}`.toLowerCase().includes(query)
        || (employee.employeeNumber ?? '').toLowerCase().includes(query)
    );
}

export function matchesOfficeFilter(employee: Employee, officeId: string): boolean {
    if (!officeId) return true;
    return employee.officeId === officeId;
}

export function filterInsuranceListRows<T extends { employee: Employee }>(
    rows: T[],
    options: { keyword: string; officeId: string },
): T[] {
    let result = rows;
    if (options.officeId) {
        result = result.filter((row) => matchesOfficeFilter(row.employee, options.officeId));
    }
    if (options.keyword.trim()) {
        result = result.filter((row) => matchesEmployeeListSearch(row.employee, options.keyword));
    }
    return result;
}
