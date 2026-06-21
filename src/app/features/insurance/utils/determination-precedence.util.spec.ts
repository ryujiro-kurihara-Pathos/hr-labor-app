import { createEmptyEmployeeInput, Employee } from '../../employee/models/employee.models';
import { SalaryCondition } from '../models/salary-condition.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { getRevisionApplyFromMonth } from './revision-determination.util';
import {
    collapseConsecutiveRevisionOrigins,
    pickWinningDeterminationCandidate,
} from './determination-precedence.util';

function employee(overrides: Partial<ReturnType<typeof createEmptyEmployeeInput>> = {}): Employee {
    return {
        id: 'e1',
        ...createEmptyEmployeeInput({
            joinedDate: '2024-04-01',
            ...overrides,
        }),
        createdAt: {} as Employee['createdAt'],
        updatedAt: {} as Employee['updatedAt'],
    };
}

function makeReward(
    targetYearMonth: string,
    monthlyReward: number,
    options: {
        fixedWageChanged?: boolean;
        healthGrade?: number;
        pensionGrade?: number;
    } = {},
): StandardMonthlyReward {
    const healthGrade = options.healthGrade ?? 20;
    const pensionGrade = options.pensionGrade ?? 18;
    return {
        id: `id_${targetYearMonth}`,
        companyId: 'c1',
        employeeId: 'e1',
        targetYearMonth,
        basicSalary: monthlyReward,
        commutingAllowance: 0,
        positionAllowance: 0,
        housingAllowance: 0,
        fixedOvertimePay: 0,
        otherFixedAllowance: 0,
        overtimePay: 0,
        holidayPay: 0,
        nightPay: 0,
        commissionPay: 0,
        otherVariablePay: 0,
        monthlyReward,
        healthInsuranceGrade: healthGrade,
        healthInsuranceStandardMonthlyAmount: 300000,
        pensionInsuranceGrade: pensionGrade,
        pensionInsuranceStandardMonthlyAmount: 300000,
        fixedWageChanged: options.fixedWageChanged ?? false,
        changedFixedWageFields: options.fixedWageChanged ? ['basicSalary'] : [],
        status: 'confirmed',
        createdAt: {} as StandardMonthlyReward['createdAt'],
        updatedAt: {} as StandardMonthlyReward['updatedAt'],
    };
}

function makeSalaryCondition(
    effectiveStartMonth: string,
    basicSalary: number,
    triggersRevision = true,
): SalaryCondition {
    return {
        id: `sc_${effectiveStartMonth}`,
        companyId: 'c1',
        employeeId: 'e1',
        effectiveStartMonth,
        basicSalary,
        commutingAllowance: 0,
        positionAllowance: 0,
        housingAllowance: 0,
        fixedOvertimePay: 0,
        otherFixedAllowance: 0,
        fixedWageTotal: basicSalary,
        note: '',
        changeReason: '',
        triggersRevision,
        createdAt: {} as SalaryCondition['createdAt'],
        updatedAt: {} as SalaryCondition['updatedAt'],
    };
}

function buildBaselineRewards(): Record<string, StandardMonthlyReward> {
    const rewards: Record<string, StandardMonthlyReward> = {};
    for (let year = 2024; year <= 2026; year += 1) {
        for (let month = 1; month <= 12; month += 1) {
            const ym = `${year}-${String(month).padStart(2, '0')}`;
            if (ym < '2024-04') continue;
            rewards[ym] = makeReward(ym, 300000);
        }
    }
    return rewards;
}

describe('determination-precedence.util revision apply timing', () => {
    const calculate = (monthlyReward: number) => {
        if (monthlyReward >= 400000) {
            return {
                health: { grade: 24, standardMonthlyAmount: 420000 },
                pension: { grade: 22, standardMonthlyAmount: 420000 },
            };
        }
        return { health: { grade: 20, standardMonthlyAmount: 300000 }, pension: { grade: 18, standardMonthlyAmount: 300000 } };
    };

    it('applies revision from the month after the 3-month calculation window (origin + 3)', () => {
        expect(getRevisionApplyFromMonth('2026-06')).toBe('2026-09');
    });

    it('does not apply June-origin revision to August liability (last calculation month)', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
        };

        const winner = pickWinningDeterminationCandidate(
            '2026-08',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
        );

        expect(winner?.kind).not.toBe('revision');
    });

    it('applies June-origin revision from September liability onward', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
        };

        const winner = pickWinningDeterminationCandidate(
            '2026-09',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
        );

        expect(winner?.kind).toBe('revision');
        expect(winner?.revisionOriginMonth).toBe('2026-06');
        expect(winner?.effectiveFrom).toBe('2026-09');
    });

    it('applies May-origin revision to August liability when May is the only change month', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-05': makeReward('2026-05', 400000, { fixedWageChanged: true }),
            '2026-06': makeReward('2026-06', 400000),
            '2026-07': makeReward('2026-07', 400000),
        };

        const winner = pickWinningDeterminationCandidate(
            '2026-08',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
        );

        expect(winner?.kind).toBe('revision');
        expect(winner?.effectiveFrom).toBe('2026-08');
    });

    it('does not apply regular determination in the same cycle after revision', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-05': makeReward('2026-05', 400000, { fixedWageChanged: true }),
            '2026-06': makeReward('2026-06', 400000),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
            '2026-09': makeReward('2026-09', 400000),
        };

        const septemberWinner = pickWinningDeterminationCandidate(
            '2026-09',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
        );
        expect(septemberWinner?.kind).toBe('revision');
        expect(septemberWinner?.effectiveFrom).toBe('2026-08');

        const octoberWinner = pickWinningDeterminationCandidate(
            '2026-10',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
        );
        expect(octoberWinner?.kind).toBe('revision');
    });

    it('keeps June-origin revision over regular determination from September onward', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
            '2026-09': makeReward('2026-09', 400000),
            '2026-10': makeReward('2026-10', 400000),
        };

        const winner = pickWinningDeterminationCandidate(
            '2026-11',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
        );
        expect(winner?.kind).toBe('revision');
        expect(winner?.revisionOriginMonth).toBe('2026-06');
    });

    it('collapses consecutive May and June fixedWageChanged flags to June origin', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-05': makeReward('2026-05', 400000, { fixedWageChanged: true }),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
        };

        expect(collapseConsecutiveRevisionOrigins(['2026-05', '2026-06'])).toEqual(['2026-06']);

        const augustWinner = pickWinningDeterminationCandidate(
            '2026-08',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
        );
        expect(augustWinner?.kind).not.toBe('revision');

        const septemberWinner = pickWinningDeterminationCandidate(
            '2026-09',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
        );
        expect(septemberWinner?.kind).toBe('revision');
        expect(septemberWinner?.revisionOriginMonth).toBe('2026-06');
    });

    it('ignores spurious reward fixedWageChanged when salary condition defines June origin', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-05': makeReward('2026-05', 400000, { fixedWageChanged: true }),
            '2026-06': makeReward('2026-06', 400000),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
        };
        const salaryConditions = [
            makeSalaryCondition('2026-06', 400000),
        ];

        const augustWinner = pickWinningDeterminationCandidate(
            '2026-08',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
            [],
            1,
            salaryConditions,
        );
        expect(augustWinner?.kind).not.toBe('revision');

        const septemberWinner = pickWinningDeterminationCandidate(
            '2026-09',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
            [],
            1,
            salaryConditions,
        );
        expect(septemberWinner?.kind).toBe('revision');
        expect(septemberWinner?.revisionOriginMonth).toBe('2026-06');
    });
});
