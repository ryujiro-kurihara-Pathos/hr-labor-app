import { createEmptyEmployeeInput, Employee } from '../../employee/models/employee.models';
import { SalaryCondition } from '../models/salary-condition.model';
import {
    buildSalaryConditionPeriods,
    resolvePreviousSalaryCondition,
    resolveSalaryConditionChangeBlockReason,
    salaryConditionPeriodIncludesConfirmedMonth,
    salaryConditionPeriodIncludesJoinMonth,
    resolveSalaryConditionForMonth,
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

            expect(reason).toContain('給与確定済み');
        });

        it('blocks edit when change target period includes confirmed months', () => {
            const existing = condition({ effectiveStartMonth: '2026-07', id: 'e1_2026-07' });
            const reason = validateSalaryConditionForm({
                form: {
                    effectiveStartMonth: '2026-07',
                    basicSalary: 260_000,
                    commutingAllowance: 10_000,
                    positionAllowance: 20_000,
                    housingAllowance: 0,
                    fixedOvertimePay: 30_000,
                    otherFixedAllowance: 0,
                    note: '',
                    changeReason: '',
                },
                employee: employee(),
                conditions: [condition(), existing],
                confirmedRewardMonths: ['2026-08'],
                editingEffectiveStartMonth: '2026-07',
            });

            expect(reason).toContain('給与確定済み');
        });

        it('blocks edit when change target period includes join month', () => {
            const existing = condition();
            const reason = validateSalaryConditionForm({
                form: {
                    effectiveStartMonth: '2026-04',
                    basicSalary: 260_000,
                    commutingAllowance: 10_000,
                    positionAllowance: 20_000,
                    housingAllowance: 0,
                    fixedOvertimePay: 30_000,
                    otherFixedAllowance: 0,
                    note: '',
                    changeReason: '',
                },
                employee: employee(),
                conditions: [existing],
                confirmedRewardMonths: [],
                editingEffectiveStartMonth: '2026-04',
            });

            expect(reason).toContain('入社月');
        });

        it('allows edit when later condition period has no confirmed or join months', () => {
            const existing = condition({ effectiveStartMonth: '2026-07', id: 'e1_2026-07' });
            const reason = validateSalaryConditionForm({
                form: {
                    effectiveStartMonth: '2026-07',
                    basicSalary: 260_000,
                    commutingAllowance: 10_000,
                    positionAllowance: 20_000,
                    housingAllowance: 0,
                    fixedOvertimePay: 30_000,
                    otherFixedAllowance: 0,
                    note: '',
                    changeReason: '',
                },
                employee: employee(),
                conditions: [condition(), existing],
                confirmedRewardMonths: ['2026-04', '2026-05', '2026-06'],
                editingEffectiveStartMonth: '2026-07',
            });

            expect(reason).toBeNull();
        });

        it('blocks edit when all fixed wage fields are unchanged', () => {
            const existing = condition({ effectiveStartMonth: '2026-07', id: 'e1_2026-07' });
            const reason = validateSalaryConditionForm({
                form: {
                    effectiveStartMonth: '2026-07',
                    basicSalary: 250_000,
                    commutingAllowance: 10_000,
                    positionAllowance: 20_000,
                    housingAllowance: 0,
                    fixedOvertimePay: 30_000,
                    otherFixedAllowance: 0,
                    note: '備考だけ変更',
                    changeReason: '理由だけ変更',
                },
                employee: employee(),
                conditions: [condition(), existing],
                confirmedRewardMonths: [],
                editingEffectiveStartMonth: '2026-07',
            });

            expect(reason).toContain('変更がありません');
        });

        it('allows edit when total is same but field breakdown differs', () => {
            const existing = condition({ effectiveStartMonth: '2026-07', id: 'e1_2026-07' });
            const reason = validateSalaryConditionForm({
                form: {
                    effectiveStartMonth: '2026-07',
                    basicSalary: 240_000,
                    commutingAllowance: 10_000,
                    positionAllowance: 30_000,
                    housingAllowance: 0,
                    fixedOvertimePay: 30_000,
                    otherFixedAllowance: 0,
                    note: '',
                    changeReason: '',
                },
                employee: employee(),
                conditions: [condition(), existing],
                confirmedRewardMonths: [],
                editingEffectiveStartMonth: '2026-07',
            });

            expect(reason).toBeNull();
        });
    });

    describe('resolveSalaryConditionChangeBlockReason', () => {
        it('detects confirmed months within a bounded period', () => {
            const conditions = [
                condition({ effectiveStartMonth: '2026-04' }),
                condition({ id: 'e1_2026-07', effectiveStartMonth: '2026-07' }),
            ];

            expect(
                salaryConditionPeriodIncludesConfirmedMonth({
                    effectiveStartMonth: '2026-04',
                    conditions,
                    confirmedRewardMonths: ['2026-06'],
                }),
            ).toBeTrue();
            expect(
                salaryConditionPeriodIncludesJoinMonth({
                    effectiveStartMonth: '2026-07',
                    conditions,
                    joinedDate: '2026-04-15',
                }),
            ).toBeFalse();
            expect(
                resolveSalaryConditionChangeBlockReason({
                    effectiveStartMonth: '2026-04',
                    conditions,
                    confirmedRewardMonths: [],
                    joinedDate: '2026-04-15',
                    isEdit: true,
                }),
            ).toContain('入社月');
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
