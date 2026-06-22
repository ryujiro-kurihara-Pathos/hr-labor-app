import { buildJoinMonthExpectedRewardInput, buildJoinMonthRewardFromSalaryCondition } from './join-month-expected-reward.util';
import {
    findEmployeeOldestUnregisteredYearMonth,
    findOldestUnregisteredYearMonth,
} from './reward-input-navigation.util';
import { Employee } from '../../employee/models/employee.models';

describe('join-month-expected-reward.util', () => {
    it('builds full-time join month reward from expected salary', () => {
        const input = buildJoinMonthExpectedRewardInput({
            companyId: 'c1',
            employeeId: 'e1',
            joinedDate: '2026-04-15',
            employmentType: 'full-time',
            expectedMonthlySalary: 280_000,
        });

        expect(input).not.toBeNull();
        expect(input!.targetYearMonth).toBe('2026-04');
        expect(input!.basicSalary).toBe(280_000);
        expect(input!.monthlyRewardAmount).toBeUndefined();
    });

    it('builds part-time join month reward with monthlyRewardAmount', () => {
        const input = buildJoinMonthExpectedRewardInput({
            companyId: 'c1',
            employeeId: 'e1',
            joinedDate: '2026-04-01',
            employmentType: 'part-time',
            expectedMonthlySalary: 90_000,
        });

        expect(input?.monthlyRewardAmount).toBe(90_000);
    });

    it('returns null for invalid salary', () => {
        expect(
            buildJoinMonthExpectedRewardInput({
                companyId: 'c1',
                employeeId: 'e1',
                joinedDate: '2026-04-01',
                employmentType: 'full-time',
                expectedMonthlySalary: 0,
            }),
        ).toBeNull();
    });

    it('builds full-time join month reward from salary condition for auto-confirm', () => {
        const input = buildJoinMonthRewardFromSalaryCondition({
            companyId: 'c1',
            employeeId: 'e1',
            joinedDate: '2024-04-01',
            employmentType: 'full-time',
            condition: {
                companyId: 'c1',
                employeeId: 'e1',
                effectiveStartMonth: '2024-04',
                basicSalary: 250_000,
                commutingAllowance: 10_000,
                positionAllowance: 0,
                housingAllowance: 0,
                fixedOvertimePay: 0,
                otherFixedAllowance: 0,
                note: '',
                changeReason: '',
            },
        });

        expect(input?.targetYearMonth).toBe('2024-04');
        expect(input?.basicSalary).toBe(250_000);
        expect(input?.commutingAllowance).toBe(10_000);
    });
});

describe('reward-input-navigation.util', () => {
    const employee = {
        id: 'e1',
        joinedDate: '2026-01-15',
        retiredDate: null,
    } as Employee;

    it('finds oldest month without confirmed reward for one employee', () => {
        const oldest = findEmployeeOldestUnregisteredYearMonth(
            employee,
            {
                '2026-01': { status: 'confirmed' },
                '2026-02': { status: 'draft' },
            } as never,
            '2026-06',
        );
        expect(oldest).toBe('2026-02');
    });

    it('finds oldest month without confirmed reward across employees', () => {
        const oldest = findOldestUnregisteredYearMonth(
            [employee],
            {
                e1: {
                    '2026-01': { status: 'confirmed' },
                    '2026-02': { status: 'draft' },
                } as never,
            },
            '2026-06',
        );
        expect(oldest).toBe('2026-02');
    });

    it('returns null when all months are confirmed', () => {
        const oldest = findOldestUnregisteredYearMonth(
            [employee],
            {
                e1: {
                    '2026-01': { status: 'confirmed' },
                    '2026-02': { status: 'confirmed' },
                    '2026-03': { status: 'confirmed' },
                    '2026-04': { status: 'confirmed' },
                    '2026-05': { status: 'confirmed' },
                    '2026-06': { status: 'confirmed' },
                    '2026-07': { status: 'confirmed' },
                } as never,
            },
            '2026-06',
        );
        expect(oldest).toBeNull();
    });
});
