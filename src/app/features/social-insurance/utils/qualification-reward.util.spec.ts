import { SalaryCondition } from '../../insurance/models/salary-condition.model';
import { StandardMonthlyReward } from '../../insurance/models/standard-monthly-reward.model';
import {
    lookupQualificationJoinMonthReward,
    resolveQualificationJoinMonthReward,
    resolveQualificationMonthlyReward,
    resolveQualificationRewardInputYearMonth,
} from './qualification-reward.util';

function reward(ym: string, monthlyReward = 280000): StandardMonthlyReward {
    return {
        id: `emp-1_${ym}`,
        targetYearMonth: ym,
        status: 'confirmed',
        monthlyReward,
    } as unknown as StandardMonthlyReward;
}

function salaryCondition(effectiveStartMonth: string, basicSalary = 300_000): SalaryCondition {
    return {
        id: `emp-1_${effectiveStartMonth}`,
        companyId: 'c1',
        employeeId: 'emp-1',
        effectiveStartMonth,
        basicSalary,
        commutingAllowance: 0,
        positionAllowance: 0,
        housingAllowance: 0,
        fixedOvertimePay: 0,
        otherFixedAllowance: 0,
        fixedWageTotal: basicSalary,
        triggersRevision: false,
        note: '',
        changeReason: '',
    } as unknown as SalaryCondition;
}

describe('qualification-reward.util', () => {
    describe('lookupQualificationJoinMonthReward', () => {
        it('prefers join month reward over pay month when both exist', () => {
            const rewards = {
                '2026-04': reward('2026-04', 300_000),
                '2026-05': reward('2026-05', 280_000),
            };

            expect(
                lookupQualificationJoinMonthReward('2026-04-01', rewards, 1)?.monthlyReward,
            ).toBe(300_000);
        });

        it('finds reward stored under pay year month when join month is missing', () => {
            const rewards = {
                '2026-05': reward('2026-05'),
            };

            expect(
                lookupQualificationJoinMonthReward('2026-04-01', rewards, 1)?.targetYearMonth,
            ).toBe('2026-05');
        });

        it('finds reward stored under join month for same-month payroll', () => {
            const rewards = {
                '2026-04': reward('2026-04'),
            };

            expect(
                lookupQualificationJoinMonthReward('2026-04-01', rewards, 0)?.targetYearMonth,
            ).toBe('2026-04');
        });

        it('returns null when reward is missing', () => {
            expect(lookupQualificationJoinMonthReward('2026-04-01', {}, 1)).toBeNull();
        });
    });

    describe('resolveQualificationRewardInputYearMonth', () => {
        it('returns pay year month for next-month payroll', () => {
            expect(resolveQualificationRewardInputYearMonth('2026-04-01', 1)).toBe('2026-05');
        });

        it('returns join year month for same-month payroll', () => {
            expect(resolveQualificationRewardInputYearMonth('2026-04-01', 0)).toBe('2026-04');
        });
    });

    describe('resolveQualificationMonthlyReward', () => {
        it('builds monthly reward from join month reward record', () => {
            expect(
                resolveQualificationMonthlyReward(
                    '2026-04-01',
                    reward('2026-05'),
                    [],
                    'full-time',
                ),
            ).toEqual({
                targetYearMonth: '2026-04',
                cashAmount: 280000,
                inKindAmount: 0,
                totalAmount: 280000,
                isMidMonthJoin: false,
                usesDirectMonthlyRewardEntry: false,
                fromExpectedSalaryCondition: false,
            });
        });

        it('includes fromExpectedSalaryCondition flag when set', () => {
            expect(
                resolveQualificationMonthlyReward(
                    '2026-04-01',
                    reward('2026-05'),
                    [],
                    'full-time',
                    true,
                )?.fromExpectedSalaryCondition,
            ).toBe(true);
        });
    });

    describe('resolveQualificationJoinMonthReward', () => {
        it('prefers salary condition over empty rewards', () => {
            const result = resolveQualificationJoinMonthReward({
                joinedDate: '2026-04-01',
                companyId: 'c1',
                employeeId: 'emp-1',
                employmentType: 'full-time',
                salaryConditions: [salaryCondition('2026-04', 300_000)],
                rewardsByYearMonth: {},
                payrollPaymentMonthOffset: 1,
            });

            expect(result.fromExpectedSalaryCondition).toBe(true);
            expect(result.reward?.basicSalary).toBe(300_000);
            expect(result.reward?.targetYearMonth).toBe('2026-04');
        });

        it('prefers salary condition over next-month monthly reward', () => {
            const rewards = {
                '2026-05': reward('2026-05', 280_000),
            };

            const result = resolveQualificationJoinMonthReward({
                joinedDate: '2026-04-01',
                companyId: 'c1',
                employeeId: 'emp-1',
                employmentType: 'full-time',
                salaryConditions: [salaryCondition('2026-04', 300_000)],
                rewardsByYearMonth: rewards,
                payrollPaymentMonthOffset: 1,
            });

            expect(result.fromExpectedSalaryCondition).toBe(true);
            expect(result.reward?.basicSalary).toBe(300_000);
            expect(result.reward?.targetYearMonth).toBe('2026-04');
        });

        it('uses initial salary condition when effective start is first pay month', () => {
            const rewards = {
                '2026-05': reward('2026-05', 280_000),
            };

            const result = resolveQualificationJoinMonthReward({
                joinedDate: '2026-04-01',
                companyId: 'c1',
                employeeId: 'emp-1',
                employmentType: 'full-time',
                salaryConditions: [salaryCondition('2026-05', 300_000)],
                rewardsByYearMonth: rewards,
                payrollPaymentMonthOffset: 1,
            });

            expect(result.fromExpectedSalaryCondition).toBe(true);
            expect(result.reward?.basicSalary).toBe(300_000);
        });

        it('part-time uses expected salary even when later pay month reward differs', () => {
            const rewards = {
                '2026-04': reward('2026-04', 108_000),
                '2026-05': reward('2026-05', 150_000),
            };

            const result = resolveQualificationJoinMonthReward({
                joinedDate: '2026-04-01',
                companyId: 'c1',
                employeeId: 'emp-1',
                employmentType: 'part-time',
                salaryConditions: [{
                    ...salaryCondition('2026-05', 100_000),
                    commutingAllowance: 5000,
                    otherFixedAllowance: 3000,
                }],
                rewardsByYearMonth: rewards,
                payrollPaymentMonthOffset: 1,
            });

            expect(result.fromExpectedSalaryCondition).toBe(true);
            expect(result.reward?.monthlyReward).toBe(108_000);
        });

        it('falls back to monthly reward when no salary condition', () => {
            const rewards = {
                '2026-05': reward('2026-05'),
            };

            const result = resolveQualificationJoinMonthReward({
                joinedDate: '2026-04-01',
                companyId: 'c1',
                employeeId: 'emp-1',
                employmentType: 'full-time',
                salaryConditions: [],
                rewardsByYearMonth: rewards,
                payrollPaymentMonthOffset: 1,
            });

            expect(result.fromExpectedSalaryCondition).toBe(false);
            expect(result.reward?.targetYearMonth).toBe('2026-05');
        });
    });
});
