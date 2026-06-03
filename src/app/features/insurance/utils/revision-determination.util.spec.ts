import {
    calculateRevisionAverageMonthlyReward,
    getRevisionApplyFromMonth,
    getRevisionCalculationMonths,
    hasRevisionGradeDifference,
    REVISION_GRADE_THRESHOLD,
} from './revision-determination.util';

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
});

function makeReward(targetYearMonth: string, total: number) {
    return {
        id: `id_${targetYearMonth}`,
        companyId: 'c1',
        employeeId: 'e1',
        targetYearMonth,
        basicSalary: total,
        commutingAllowance: 0,
        monthlyAllowance: 0,
        positionAllowance: 0,
        housingAllowance: 0,
        fixedOvertimePay: 0,
        healthInsuranceGrade: 20,
        healthInsuranceStandardMonthlyAmount: 300000,
        pensionInsuranceGrade: 18,
        pensionInsuranceStandardMonthlyAmount: 300000,
        fixedWageChanged: false,
        changedFixedWageFields: [],
        createdAt: {} as never,
        updatedAt: {} as never,
    };
}
