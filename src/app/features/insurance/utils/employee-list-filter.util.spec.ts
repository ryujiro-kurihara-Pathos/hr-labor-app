import { Employee } from '../../employee/models/employee.models';
import { filterInsuranceListRows, matchesEmployeeListSearch } from './employee-list-filter.util';

function employee(overrides: Partial<Employee> = {}): Employee {
    return {
        id: 'e1',
        companyId: 'c1',
        officeId: 'o1',
        lastName: '田中',
        firstName: '太郎',
        lastNameKana: 'タナカ',
        firstNameKana: 'タロウ',
        employeeNumber: 'A001',
        ...overrides,
    } as Employee;
}

describe('employee-list-filter.util', () => {
    it('matches employee name, kana, and employee number', () => {
        const row = { employee: employee() };
        expect(matchesEmployeeListSearch(row.employee, '田中')).toBeTrue();
        expect(matchesEmployeeListSearch(row.employee, 'タロウ')).toBeTrue();
        expect(matchesEmployeeListSearch(row.employee, 'a001')).toBeTrue();
        expect(matchesEmployeeListSearch(row.employee, '佐藤')).toBeFalse();
    });

    it('filters rows by office and keyword', () => {
        const rows = [
            { employee: employee({ id: 'e1', officeId: 'o1' }) },
            { employee: employee({ id: 'e2', officeId: 'o2', lastName: '佐藤', firstName: '花子' }) },
        ];

        expect(filterInsuranceListRows(rows, { keyword: '', officeId: 'o2' })).toHaveSize(1);
        expect(filterInsuranceListRows(rows, { keyword: '田中', officeId: '' })).toHaveSize(1);
        expect(filterInsuranceListRows(rows, { keyword: '佐藤', officeId: 'o2' })).toHaveSize(1);
    });
});
