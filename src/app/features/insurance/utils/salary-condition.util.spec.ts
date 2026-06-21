import { createEmptyEmployeeInput, Employee } from '../../employee/models/employee.models';
import { SalaryCondition } from '../models/salary-condition.model';
import {
    buildSalaryConditionPeriods,
    resolveSalaryConditionForMonth,
    resolvePreviousSalaryCondition,
    shouldTriggerRevisionFromSalaryCondition,
    validateSalaryConditionForm,
} from './salary-condition.util';

function employee(overrides: Partial<ReturnType<typeof createEmptyEmployeeInput>> = {}): Employee {
    return {
        id: 'e1',
        ...createEmptyEmployeeInput({
            joinedDate: '2026-04-15',
            ...overrides,
        }),
        createdAt: {} as Employee['createdAt'],
        updatedAt: {} as Employee['updatedAt'],
    };
}

function condition(overrides: Partial<SalaryCondition> = {}): SalaryCondition {
    return {
        id: 'e1_2026-04',
        companyId: 'c1',
        employeeId: 'e1',
        effectiveStartMonth: '2026-04',
        basicSalary: 250_000,
        commutingAllowance: 10_000,
        positionAllowance: 20_000,
        housingAllowance: 0,
        fixedOvertimePay: 30_000,
        otherFixedAllowance: 0,
        fixedWageTotal: 310_000,
        triggersRevision: false,
        note: '',
        changeReason: '',
        createdAt: {} as SalaryCondition['createdAt'],
        updatedAt: {} as SalaryCondition['updatedAt'],
        ...overrides,
    };
}

describe('salary-condition.util', () => {
    describe('resolveSalaryConditionForMonth', () => {
        it('returns the latest condition that started on or before target month', () => {
            const conditions = [
                condition({ effectiveStartMonth: '2026-04', fixedWageTotal: 300_000 }),
                condition({ id: 'e1_2026-07', effectiveStartMonth: '2026-07', fixedWageTotal: 330_000 }),
            ];

            expect(resolveSalaryConditionForMonth(conditions, '2026-06')?.fixedWageTotal).toBe(300_000);
            expect(resolveSalaryConditionForMonth(conditions, '2026-07')?.fixedWageTotal).toBe(330_000);
        });
    });

    describe('buildSalaryConditionPeriods', () => {
        it('derives display end month from next condition start month', () => {
            const periods = buildSalaryConditionPeriods([
                condition({ effectiveStartMonth: '2026-04', fixedWageTotal: 300_000 }),
                condition({ id: 'e1_2026-07', effectiveStartMonth: '2026-07', fixedWageTotal: 330_000 }),
            ]);

            expect(periods[0]?.displayEndMonth).toBe('2026-06');
            expect(periods[0]?.displayLabel).toContain('2026年4月');
            expect(periods[1]?.displayEndMonth).toBeNull();
            expect(periods[1]?.displayLabel).toContain('現在');
        });
    });

    describe('shouldTriggerRevisionFromSalaryCondition', () => {
        it('returns true only when fixed wage total changes', () => {
            const previous = condition({ fixedWageTotal: 310_000 });
            const nextInput = {
                ...previous,
                positionAllowance: 30_000,
            };

            expect(shouldTriggerRevisionFromSalaryCondition(nextInput, previous)).toBeTrue();

            const sameTotal = {
                ...previous,
                positionAllowance: 10_000,
                housingAllowance: 10_000,
            };
            expect(shouldTriggerRevisionFromSalaryCondition(sameTotal, previous)).toBeFalse();
        });
    });

    describe('validateSalaryConditionForm', () => {
        it('blocks new condition before join month', () => {
            const reason = validateSalaryConditionForm({
                form: {
                    effectiveStartMonth: '2026-03',
                    basicSalary: 250_000,
                    commutingAllowance: 0,
                    positionAllowance: 0,
                    housingAllowance: 0,
                    fixedOvertimePay: 0,
                    otherFixedAllowance: 0,
                    note: '',
                    changeReason: '',
                },
                employee: employee(),
                conditions: [],
                confirmedRewardMonths: [],
            });

            expect(reason).toContain('2026年4月');
        });

        it('blocks new condition that affects confirmed months', () => {
            const reason = validateSalaryConditionForm({
                form: {
                    effectiveStartMonth: '2026-06',
                    basicSalary: 250_000,
                    commutingAllowance: 0,
                    positionAllowance: 0,
                    housingAllowance: 0,
                    fixedOvertimePay: 0,
                    otherFixedAllowance: 0,
                    note: '',
                    changeReason: '',
                },
                employee: employee(),
                conditions: [],
                confirmedRewardMonths: ['2026-06'],
            });

            expect(reason).toContain('確定済み');
        });
    });

    describe('resolvePreviousSalaryCondition', () => {
        it('returns the latest earlier condition', () => {
            const conditions = [
                condition({ effectiveStartMonth: '2026-04' }),
                condition({ id: 'e1_2026-07', effectiveStartMonth: '2026-07' }),
            ];

            expect(resolvePreviousSalaryCondition(conditions, '2026-07')?.effectiveStartMonth).toBe('2026-04');
        });
    });
});
