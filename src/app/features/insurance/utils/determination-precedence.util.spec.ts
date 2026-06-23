import { createEmptyEmployeeInput, Employee } from '../../employee/models/employee.models';
import { SalaryCondition } from '../models/salary-condition.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { getRevisionApplyFromMonth } from './revision-determination.util';
import {
    dedupeConsecutiveRevisionOriginsWithSameFixedWage,
    evaluateRevisionAtOrigin,
    evaluateRevisionEligibilityForPayMonth,
    formatRevisionEligibilityWarningMessage,
    hasEligibleRevisionBeforeMonth,
    listEligibleRevisionCandidates,
    listEligibleRevisionProcedureContextsForMonth,
    pickWinningDeterminationCandidate,
    resolveRevisionOriginMonths,
    revisionSupersedesRegularDeterminationForBaseYear,
} from './determination-precedence.util';
import { resolvePremiumStandardDeterminationYearMonth } from '../../company/utils/company-payroll-settings.util';

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

    it('does not apply June-origin revision before apply pay month (origin + 3)', () => {
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

    it('applies June-origin revision from apply pay month onward (origin + 3)', () => {
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

    it('applies June-origin revision to October pay deduction month when next_month collection', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
        };

        const septemberPayWinner = pickWinningDeterminationCandidate(
            resolvePremiumStandardDeterminationYearMonth('2026-09', 'next_month'),
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
        );
        expect(septemberPayWinner?.kind).not.toBe('revision');

        const octoberPayWinner = pickWinningDeterminationCandidate(
            resolvePremiumStandardDeterminationYearMonth('2026-10', 'next_month'),
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            calculate,
        );
        expect(octoberPayWinner?.kind).toBe('revision');
        expect(octoberPayWinner?.revisionOriginMonth).toBe('2026-06');
    });

    it('keeps June-origin revision effectiveFrom at apply pay month', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
        };

        const winner = pickWinningDeterminationCandidate(
            '2026-10',
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

    it('applies May-origin revision from apply pay month when May is the only change month', () => {
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

    it('dedupes consecutive origins with the same fixed wage to the later month', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-05': makeReward('2026-05', 400000, { fixedWageChanged: true }),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
        };

        expect(
            dedupeConsecutiveRevisionOriginsWithSameFixedWage(
                ['2026-05', '2026-06'],
                rewards,
            ),
        ).toEqual(['2026-06']);

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

    it('keeps consecutive origins when fixed wages differ and applies both revisions', () => {
        const tieredCalculate = (monthlyReward: number) => {
            if (monthlyReward >= 400_000) {
                return {
                    health: { grade: 24, standardMonthlyAmount: 420_000 },
                    pension: { grade: 22, standardMonthlyAmount: 420_000 },
                };
            }
            if (monthlyReward >= 350_000) {
                return {
                    health: { grade: 22, standardMonthlyAmount: 360_000 },
                    pension: { grade: 20, standardMonthlyAmount: 360_000 },
                };
            }
            return {
                health: { grade: 20, standardMonthlyAmount: 300_000 },
                pension: { grade: 18, standardMonthlyAmount: 300_000 },
            };
        };

        const rewards = {
            ...buildBaselineRewards(),
            '2026-04': makeReward('2026-04', 350_000, { fixedWageChanged: true }),
            '2026-05': makeReward('2026-05', 400_000, { fixedWageChanged: true }),
            '2026-06': makeReward('2026-06', 400_000),
            '2026-07': makeReward('2026-07', 400_000),
            '2026-08': makeReward('2026-08', 400_000),
        };

        expect(resolveRevisionOriginMonths(rewards)).toEqual(['2026-04', '2026-05']);

        const candidates = listEligibleRevisionCandidates(
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            tieredCalculate,
        );
        expect(candidates.map((item) => item.revisionOriginMonth)).toEqual(['2026-04', '2026-05']);

        const julyWinner = pickWinningDeterminationCandidate(
            '2026-07',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            tieredCalculate,
        );
        expect(julyWinner?.kind).toBe('revision');
        expect(julyWinner?.revisionOriginMonth).toBe('2026-04');

        const augustWinner = pickWinningDeterminationCandidate(
            '2026-08',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            tieredCalculate,
        );
        expect(augustWinner?.kind).toBe('revision');
        expect(augustWinner?.revisionOriginMonth).toBe('2026-05');

        const juneContexts = listEligibleRevisionProcedureContextsForMonth(
            '2026-06',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            tieredCalculate,
        );
        expect(juneContexts.map((item) => item.originMonth)).toEqual(['2026-04', '2026-05']);

        const julyContexts = listEligibleRevisionProcedureContextsForMonth(
            '2026-07',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            tieredCalculate,
        );
        expect(julyContexts.map((item) => item.originMonth)).toEqual(['2026-05']);
    });

    it('rejects revision when payment base days are insufficient in calculation months', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
        };

        const result = evaluateRevisionAtOrigin(
            '2026-06',
            '2024-04',
            '2024-09',
            employee({ joinedDate: '2026-06-20' }),
            '2026-06-20',
            rewards,
            calculate,
        );

        expect(result.eligible).toBeFalse();
        if (!result.eligible) {
            expect(result.reason).toBe('insufficient_payment_base_days');
        }
    });

    it('rejects revision when grade direction does not match fixed wage change', () => {
        const mismatchCalculate = (monthlyReward: number) => {
            if (monthlyReward >= 400000) {
                return {
                    health: { grade: 16, standardMonthlyAmount: 200000 },
                    pension: { grade: 14, standardMonthlyAmount: 200000 },
                };
            }
            return {
                health: { grade: 20, standardMonthlyAmount: 300000 },
                pension: { grade: 18, standardMonthlyAmount: 300000 },
            };
        };
        const rewards = {
            ...buildBaselineRewards(),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
        };

        const result = evaluateRevisionAtOrigin(
            '2026-06',
            '2024-04',
            '2024-09',
            employee(),
            '2024-04-01',
            rewards,
            mismatchCalculate,
        );

        expect(result.eligible).toBeFalse();
        if (!result.eligible) {
            expect(result.reason).toBe('grade_direction_mismatch');
        }
    });

    it('prefers revision over regular determination when both apply from the same month', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
            '2026-07': makeReward('2026-07', 400000),
            '2026-08': makeReward('2026-08', 400000),
            '2026-09': makeReward('2026-09', 400000),
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
        expect(winner?.effectiveFrom).toBe('2026-09');
        expect(winner?.revisionOriginMonth).toBe('2026-06');
    });

    it('ignores spurious reward fixedWageChanged when salary condition defines June origin', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-05': makeReward('2026-05', 300000, { fixedWageChanged: true }),
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

describe('determination-precedence.util February join revision', () => {
    const febJoinCalculate = (monthlyReward: number) => {
        if (monthlyReward >= 250_000) {
            return {
                health: { grade: 20, standardMonthlyAmount: 260_000 },
                pension: { grade: 17, standardMonthlyAmount: 260_000 },
            };
        }
        return {
            health: { grade: 18, standardMonthlyAmount: 220_000 },
            pension: { grade: 15, standardMonthlyAmount: 220_000 },
        };
    };

    it('approves April-origin revision using join month expected salary, not next month pay', () => {
        const rewards = {
            '2025-03': makeReward('2025-03', 220_000),
            '2025-04': makeReward('2025-04', 270_000, { fixedWageChanged: true }),
            '2025-05': makeReward('2025-05', 280_000),
            '2025-06': makeReward('2025-06', 260_000),
        };
        rewards['2025-04'] = {
            ...rewards['2025-04'],
            basicSalary: 260_000,
            overtimePay: 10_000,
            monthlyReward: 270_000,
        };
        rewards['2025-05'] = {
            ...rewards['2025-05'],
            basicSalary: 260_000,
            overtimePay: 20_000,
            monthlyReward: 280_000,
        };
        rewards['2025-06'] = {
            ...rewards['2025-06'],
            basicSalary: 260_000,
            monthlyReward: 260_000,
        };

        const salaryConditions = [makeSalaryCondition('2025-02', 220_000, false)];

        const result = evaluateRevisionAtOrigin(
            '2025-04',
            '2025-02',
            '2025-09',
            employee({ joinedDate: '2025-02-01' }),
            '2025-02-01',
            rewards,
            febJoinCalculate,
            [],
            1,
            salaryConditions,
        );

        expect(result.eligible).toBeTrue();
        if (result.eligible) {
            expect(result.averageMonthlyReward).toBe(270_000);
            expect(result.previousGrades.health.grade).toBe(18);
            expect(result.revisedGrades.health.grade).toBe(20);
        }

        const julyPayWinner = pickWinningDeterminationCandidate(
            '2025-07',
            '2025-02',
            '2025-09',
            employee({ joinedDate: '2025-02-01' }),
            '2025-02-01',
            rewards,
            febJoinCalculate,
            [],
            1,
            salaryConditions,
        );
        expect(julyPayWinner?.kind).toBe('revision');
        expect(julyPayWinner?.revisionOriginMonth).toBe('2025-04');
    });

    it('supersedes regular determination for base year when April-origin revision is eligible', () => {
        const rewards = {
            '2025-03': makeReward('2025-03', 220_000),
            '2025-04': makeReward('2025-04', 270_000, { fixedWageChanged: true }),
            '2025-05': makeReward('2025-05', 280_000),
            '2025-06': makeReward('2025-06', 260_000),
        };
        rewards['2025-04'] = {
            ...rewards['2025-04'],
            basicSalary: 260_000,
            overtimePay: 10_000,
            monthlyReward: 270_000,
        };
        rewards['2025-05'] = {
            ...rewards['2025-05'],
            basicSalary: 260_000,
            overtimePay: 20_000,
            monthlyReward: 280_000,
        };
        rewards['2025-06'] = {
            ...rewards['2025-06'],
            basicSalary: 260_000,
            monthlyReward: 260_000,
        };

        const salaryConditions = [makeSalaryCondition('2025-02', 220_000, false)];
        const employeeFeb = employee({ joinedDate: '2025-02-01' });

        const revisionCandidates = listEligibleRevisionCandidates(
            '2025-02',
            '2025-09',
            employeeFeb,
            '2025-02-01',
            rewards,
            febJoinCalculate,
            [],
            salaryConditions,
        );

        expect(revisionCandidates.length).toBeGreaterThan(0);
        expect(revisionSupersedesRegularDeterminationForBaseYear(2025, revisionCandidates)).toBeTrue();
        expect(
            hasEligibleRevisionBeforeMonth(
                '2025-09',
                '2025-02',
                '2025-09',
                employeeFeb,
                '2025-02-01',
                rewards,
                febJoinCalculate,
                [],
                salaryConditions,
            ),
        ).toBeTrue();

        const septemberWinner = pickWinningDeterminationCandidate(
            '2025-09',
            '2025-02',
            '2025-09',
            employeeFeb,
            '2025-02-01',
            rewards,
            febJoinCalculate,
            [],
            1,
            salaryConditions,
        );
        expect(septemberWinner?.kind).toBe('revision');
    });
});

describe('resolveRevisionOriginMonths merge', () => {
    it('merges reward fixedWageChanged months with salary condition origins and dedupes same fixed wage', () => {
        const rewards = {
            ...buildBaselineRewards(),
            '2026-05': makeReward('2026-05', 300000, { fixedWageChanged: true }),
            '2026-06': makeReward('2026-06', 400000, { fixedWageChanged: true }),
        };
        const conditions = [makeSalaryCondition('2026-06', 400000)];

        expect(resolveRevisionOriginMonths(rewards, conditions)).toEqual(['2026-06']);
    });

    it('keeps reward-only origin when salary conditions are empty', () => {
        const rewards = {
            '2025-04': makeReward('2025-04', 270_000, { fixedWageChanged: true }),
        };

        expect(resolveRevisionOriginMonths(rewards, [])).toEqual(['2025-04']);
    });
});

describe('evaluateRevisionEligibilityForPayMonth', () => {
    const calculate = (monthlyReward: number) => {
        if (monthlyReward >= 250_000) {
            return {
                health: { grade: 20, standardMonthlyAmount: 260_000 },
                pension: { grade: 17, standardMonthlyAmount: 260_000 },
            };
        }
        return {
            health: { grade: 18, standardMonthlyAmount: 220_000 },
            pension: { grade: 15, standardMonthlyAmount: 220_000 },
        };
    };

    it('reports missing_months when only the first calculation month is confirmed', () => {
        const rewards = {
            '2025-03': makeReward('2025-03', 220_000),
            '2025-04': makeReward('2025-04', 270_000, { fixedWageChanged: true }),
        };
        rewards['2025-04'] = {
            ...rewards['2025-04'],
            basicSalary: 260_000,
            overtimePay: 10_000,
            monthlyReward: 270_000,
        };

        const entry = evaluateRevisionEligibilityForPayMonth(
            '2025-04',
            '2025-02',
            '2025-09',
            employee({ joinedDate: '2025-02-01' }),
            '2025-02-01',
            rewards,
            calculate,
            [],
            1,
            [makeSalaryCondition('2025-02', 220_000, false)],
        );

        expect(entry?.originMonth).toBe('2025-04');
        expect(entry?.result.eligible).toBeFalse();
        if (entry && !entry.result.eligible) {
            expect(entry.result.reason).toBe('missing_months');
        }

        const message = formatRevisionEligibilityWarningMessage(
            entry!,
            ['基本給'],
            1,
        );
        expect(message).toContain('2025年4月');
        expect(message).toContain('すべて確定');
    });
});

describe('evaluateRevisionAtOrigin previous grades fallback', () => {
    const aprilJoinCalculate = (monthlyReward: number) => {
        if (monthlyReward >= 250_000) {
            return {
                health: { grade: 20, standardMonthlyAmount: 260_000 },
                pension: { grade: 17, standardMonthlyAmount: 260_000 },
            };
        }
        return {
            health: { grade: 18, standardMonthlyAmount: 220_000 },
            pension: { grade: 15, standardMonthlyAmount: 220_000 },
        };
    };

    it('uses qualification initial grades when baseline month is before initial effectiveFrom (April join, May origin)', () => {
        const rewards = {
            '2025-05': makeReward('2025-05', 270_000, { fixedWageChanged: true }),
            '2025-06': makeReward('2025-06', 280_000),
            '2025-07': makeReward('2025-07', 260_000),
        };
        rewards['2025-05'] = {
            ...rewards['2025-05'],
            basicSalary: 260_000,
            overtimePay: 10_000,
            monthlyReward: 270_000,
        };
        rewards['2025-06'] = {
            ...rewards['2025-06'],
            basicSalary: 260_000,
            overtimePay: 20_000,
            monthlyReward: 280_000,
        };
        rewards['2025-07'] = {
            ...rewards['2025-07'],
            basicSalary: 260_000,
            monthlyReward: 260_000,
        };

        const salaryConditions = [makeSalaryCondition('2025-04', 220_000, false)];

        const result = evaluateRevisionAtOrigin(
            '2025-05',
            '2025-04',
            '2025-09',
            employee({ joinedDate: '2025-04-01' }),
            '2025-04-01',
            rewards,
            aprilJoinCalculate,
            [],
            1,
            salaryConditions,
        );

        expect(result.eligible).toBeTrue();
        if (result.eligible) {
            expect(result.previousGrades.health.grade).toBe(18);
            expect(result.revisedGrades.health.grade).toBe(20);
        }
    });
});
