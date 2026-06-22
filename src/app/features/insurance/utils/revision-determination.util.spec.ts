import {
    calculateRegularDeterminationAverageMonthlyReward,
    calculateRevisionAverageMonthlyReward,
    formatRevisionApplyFromPayMonthLabel,
    getRevisionApplyFromMonth,
    getRevisionCalculationMonths,
    hasRevisionGradeDifference,
    hasRevisionGradeDirectionMatch,
    resolveFixedWageChangeDirection,
    revisionCalculationMonthsMeetPaymentBaseDays,
    REVISION_GRADE_THRESHOLD,
} from './revision-determination.util';
import { createEmptyEmployeeInput, Employee } from '../../employee/models/employee.models';
import { SalaryCondition } from '../models/salary-condition.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';

describe('revision-determination.util', () => {
    describe('hasRevisionGradeDifference', () => {
        it('健康保険で2等級差があれば true', () => {
            expect(
                hasRevisionGradeDifference(
                    { health: { grade: 20 }, pension: { grade: 18 } },
                    { health: { grade: 22 }, pension: { grade: 18 } },
                ),
            ).toBeTrue();
        });

        it('厚生年金で2等級差があれば true', () => {
            expect(
                hasRevisionGradeDifference(
                    { health: { grade: 20 }, pension: { grade: 18 } },
                    { health: { grade: 20 }, pension: { grade: 20 } },
                ),
            ).toBeTrue();
        });

        it('1等級差のみなら false', () => {
            expect(
                hasRevisionGradeDifference(
                    { health: { grade: 20 }, pension: { grade: 18 } },
                    { health: { grade: 21 }, pension: { grade: 19 } },
                ),
            ).toBeFalse();
        });

        it('2等級下がりでも true', () => {
            expect(
                hasRevisionGradeDifference(
                    { health: { grade: 22 }, pension: { grade: 20 } },
                    { health: { grade: 20 }, pension: { grade: 20 } },
                ),
            ).toBeTrue();
        });

        it('カスタム threshold を受け取れる', () => {
            expect(
                hasRevisionGradeDifference(
                    { health: { grade: 20 }, pension: { grade: 18 } },
                    { health: { grade: 21 }, pension: { grade: 18 } },
                    1,
                ),
            ).toBeTrue();
            expect(REVISION_GRADE_THRESHOLD).toBe(2);
        });
    });

    describe('calculateRegularDeterminationAverageMonthlyReward', () => {
        it('returns average of calculation months without bonus', () => {
            const rewards = {
                '2026-04': makeReward('2026-04', 300000),
                '2026-05': makeReward('2026-05', 360000),
            };

            expect(
                calculateRegularDeterminationAverageMonthlyReward(rewards, [
                    '2026-04',
                    '2026-05',
                ]),
            ).toBe(330000);
        });

        it('returns null when a calculation month is missing', () => {
            const rewards = {
                '2026-04': makeReward('2026-04', 300000),
            };

            expect(
                calculateRegularDeterminationAverageMonthlyReward(rewards, [
                    '2026-04',
                    '2026-05',
                ]),
            ).toBeNull();
        });

        it('returns null when a calculation month reward is not confirmed', () => {
            const rewards = {
                '2026-04': { ...makeReward('2026-04', 300000), status: 'draft' as const },
                '2026-05': makeReward('2026-05', 360000),
            };

            expect(
                calculateRegularDeterminationAverageMonthlyReward(rewards, [
                    '2026-04',
                    '2026-05',
                ]),
            ).toBeNull();
        });
    });

    describe('calculateRevisionAverageMonthlyReward', () => {
        it('変更月から3か月分の平均を返す', () => {
            const rewards = {
                '2025-08': makeReward('2025-08', 300000),
                '2025-09': makeReward('2025-09', 300000),
                '2025-10': makeReward('2025-10', 360000),
            };

            expect(calculateRevisionAverageMonthlyReward(rewards, '2025-08')).toBe(320000);
            expect(getRevisionCalculationMonths('2025-08')).toEqual([
                '2025-08',
                '2025-09',
                '2025-10',
            ]);
            expect(getRevisionApplyFromMonth('2025-08')).toBe('2025-11');
        });

        it('3か月分が揃わない場合は null', () => {
            const rewards = {
                '2025-08': makeReward('2025-08', 300000),
                '2025-09': makeReward('2025-09', 300000),
            };

            expect(calculateRevisionAverageMonthlyReward(rewards, '2025-08')).toBeNull();
        });
    });

    describe('formatRevisionApplyFromPayMonthLabel', () => {
        it('翌月払いでも支給年月ラベルをそのまま表示する', () => {
            expect(formatRevisionApplyFromPayMonthLabel('2026-09', 1)).toBe('2026年9月');
        });

        it('当月払いでは勤務月と同じラベルになる', () => {
            expect(formatRevisionApplyFromPayMonthLabel('2026-09', 0)).toBe('2026年9月');
        });
    });

    describe('revisionCalculationMonthsMeetPaymentBaseDays', () => {
        it('3か月すべて17日以上なら true', () => {
            const emp = employee({ joinedDate: '2024-04-01' });
            expect(
                revisionCalculationMonthsMeetPaymentBaseDays(
                    emp,
                    '2026-06',
                    '2024-04-01',
                    1,
                ),
            ).toBeTrue();
        });

        it('起算月が17日未満なら false', () => {
            const emp = employee({ joinedDate: '2026-06-20' });
            expect(
                revisionCalculationMonthsMeetPaymentBaseDays(
                    emp,
                    '2026-06',
                    '2026-06-20',
                    1,
                ),
            ).toBeFalse();
        });
    });

    describe('resolveFixedWageChangeDirection', () => {
        it('前月報酬より固定的賃金が増えていれば increase', () => {
            const rewards = {
                '2026-05': makeReward('2026-05', 300000),
                '2026-06': makeReward('2026-06', 400000),
            };
            expect(resolveFixedWageChangeDirection(rewards, '2026-06')).toBe('increase');
        });

        it('給与条件を優先して方向を判定する', () => {
            const rewards = {
                '2026-05': makeReward('2026-05', 300000),
                '2026-06': makeReward('2026-06', 300000),
            };
            const conditions: SalaryCondition[] = [
                {
                    id: 'sc1',
                    companyId: 'c1',
                    employeeId: 'e1',
                    effectiveStartMonth: '2026-05',
                    basicSalary: 300000,
                    commutingAllowance: 0,
                    positionAllowance: 0,
                    housingAllowance: 0,
                    fixedOvertimePay: 0,
                    otherFixedAllowance: 0,
                    fixedWageTotal: 300000,
                    note: '',
                    changeReason: '',
                    triggersRevision: true,
                    createdAt: {} as never,
                    updatedAt: {} as never,
                },
                {
                    id: 'sc2',
                    companyId: 'c1',
                    employeeId: 'e1',
                    effectiveStartMonth: '2026-06',
                    basicSalary: 400000,
                    commutingAllowance: 0,
                    positionAllowance: 0,
                    housingAllowance: 0,
                    fixedOvertimePay: 0,
                    otherFixedAllowance: 0,
                    fixedWageTotal: 400000,
                    note: '',
                    changeReason: '',
                    triggersRevision: true,
                    createdAt: {} as never,
                    updatedAt: {} as never,
                },
            ];
            expect(resolveFixedWageChangeDirection(rewards, '2026-06', conditions)).toBe('increase');
        });

        it('uses confirmed reward fixed wages when salary condition is unchanged', () => {
            const rewards: Record<string, StandardMonthlyReward> = {
                '2025-03': {
                    ...makeReward('2025-03', 220_000),
                    basicSalary: 220_000,
                    monthlyReward: 220_000,
                    status: 'confirmed',
                },
                '2025-04': {
                    ...makeReward('2025-04', 260_000),
                    basicSalary: 260_000,
                    monthlyReward: 260_000,
                    fixedWageChanged: true,
                    status: 'confirmed',
                },
            };
            const conditions: SalaryCondition[] = [
                {
                    id: 'sc1',
                    companyId: 'c1',
                    employeeId: 'e1',
                    effectiveStartMonth: '2025-02',
                    basicSalary: 260_000,
                    commutingAllowance: 0,
                    positionAllowance: 0,
                    housingAllowance: 0,
                    fixedOvertimePay: 0,
                    otherFixedAllowance: 0,
                    fixedWageTotal: 260_000,
                    note: '',
                    changeReason: '',
                    triggersRevision: false,
                    createdAt: {} as never,
                    updatedAt: {} as never,
                },
            ];
            expect(resolveFixedWageChangeDirection(rewards, '2025-04', conditions)).toBe('increase');
        });

        it('前月報酬が未登録でも給与条件を基準に方向を判定する', () => {
            const rewards: Record<string, StandardMonthlyReward> = {
                '2025-05': {
                    ...makeReward('2025-05', 270_000),
                    basicSalary: 260_000,
                    monthlyReward: 270_000,
                    fixedWageChanged: true,
                    status: 'confirmed',
                },
            };
            const conditions: SalaryCondition[] = [
                {
                    id: 'sc1',
                    companyId: 'c1',
                    employeeId: 'e1',
                    effectiveStartMonth: '2025-04',
                    basicSalary: 220_000,
                    commutingAllowance: 0,
                    positionAllowance: 0,
                    housingAllowance: 0,
                    fixedOvertimePay: 0,
                    otherFixedAllowance: 0,
                    fixedWageTotal: 220_000,
                    note: '',
                    changeReason: '',
                    triggersRevision: false,
                    createdAt: {} as never,
                    updatedAt: {} as never,
                },
            ];
            expect(resolveFixedWageChangeDirection(rewards, '2025-05', conditions)).toBe('increase');
        });
    });

    describe('hasRevisionGradeDirectionMatch', () => {
        it('固定的賃金増と等級上昇が一致すれば true', () => {
            expect(
                hasRevisionGradeDirectionMatch(
                    { health: { grade: 20 }, pension: { grade: 18 } },
                    { health: { grade: 22 }, pension: { grade: 20 } },
                    'increase',
                ),
            ).toBeTrue();
        });

        it('固定的賃金増なのに等級が下がれば false', () => {
            expect(
                hasRevisionGradeDirectionMatch(
                    { health: { grade: 22 }, pension: { grade: 20 } },
                    { health: { grade: 20 }, pension: { grade: 20 } },
                    'increase',
                ),
            ).toBeFalse();
        });
    });
});

function makeReward(targetYearMonth: string, total: number) {
    return {
        id: `id_${targetYearMonth}`,
        companyId: 'c1',
        employeeId: 'e1',
        targetYearMonth,
        basicSalary: total,
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
        healthInsuranceGrade: 20,
        healthInsuranceStandardMonthlyAmount: 300000,
        pensionInsuranceGrade: 18,
        pensionInsuranceStandardMonthlyAmount: 300000,
        fixedWageChanged: false,
        changedFixedWageFields: [],
        status: 'confirmed' as const,
        createdAt: {} as never,
        updatedAt: {} as never,
    };
}

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
