import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import {
    bonusesForStandardBonusPremium,
    countBonusPaymentsInCalendarYear,
    effectiveMonthlyRewardFromBase,
    effectiveMonthlyRewardTotal,
    shouldTreatBonusAsMonthlyRemuneration,
} from './effective-monthly-reward.util';

function makeBonus(targetYearMonth: string, amount: number): BonusReward {
    return {
        id: `bonus_${targetYearMonth}`,
        companyId: 'c1',
        employeeId: 'e1',
        paymentDate: `${targetYearMonth}-25`,
        targetYearMonth,
        bonusAmount: amount,
        standardBonusAmount: amount,
        createdAt: {} as BonusReward['createdAt'],
        updatedAt: {} as BonusReward['updatedAt'],
    };
}

function makeReward(overrides: Partial<StandardMonthlyReward> = {}): StandardMonthlyReward {
    return {
        id: 'r1',
        companyId: 'c1',
        employeeId: 'e1',
        targetYearMonth: '2026-04',
        basicSalary: 300_000,
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
        healthInsuranceStandardMonthlyAmount: 300_000,
        pensionInsuranceGrade: 18,
        pensionInsuranceStandardMonthlyAmount: 300_000,
        createdAt: {} as StandardMonthlyReward['createdAt'],
        updatedAt: {} as StandardMonthlyReward['updatedAt'],
        ...overrides,
    };
}

describe('effective-monthly-reward.util', () => {
    describe('shouldTreatBonusAsMonthlyRemuneration', () => {
        it('暦年3回以下は月次報酬に算入しない', () => {
            const bonuses = [
                makeBonus('2026-01', 50_000),
                makeBonus('2026-04', 50_000),
                makeBonus('2026-07', 50_000),
            ];
            expect(countBonusPaymentsInCalendarYear(bonuses, 2026)).toBe(3);
            expect(shouldTreatBonusAsMonthlyRemuneration(bonuses, '2026-07')).toBeFalse();
        });

        it('暦年4回以上は支給額に関係なく月次報酬に算入する', () => {
            const bonuses = [
                makeBonus('2026-01', 50_000),
                makeBonus('2026-04', 80_000),
                makeBonus('2026-07', 30_000),
                makeBonus('2026-10', 100_000),
            ];
            expect(shouldTreatBonusAsMonthlyRemuneration(bonuses, '2026-10')).toBeTrue();
        });
    });

    describe('effectiveMonthlyRewardTotal', () => {
        it('年4回以上の場合、対象月の賞与を加算する', () => {
            const reward = makeReward();
            const bonuses = [
                makeBonus('2026-01', 10_000),
                makeBonus('2026-04', 20_000),
                makeBonus('2026-07', 30_000),
                makeBonus('2026-10', 40_000),
            ];
            expect(effectiveMonthlyRewardTotal(reward, '2026-04', bonuses)).toBe(320_000);
        });

        it('年3回以下の場合、賞与を加算しない', () => {
            const reward = makeReward();
            const bonuses = [
                makeBonus('2026-01', 10_000),
                makeBonus('2026-06', 200_000),
                makeBonus('2026-12', 200_000),
            ];
            expect(effectiveMonthlyRewardTotal(reward, '2026-06', bonuses)).toBe(300_000);
        });
    });

    describe('effectiveMonthlyRewardFromBase', () => {
        it('年4回以上の場合、ベース報酬に賞与を加算する', () => {
            const bonuses = [
                makeBonus('2026-01', 10_000),
                makeBonus('2026-02', 10_000),
                makeBonus('2026-03', 10_000),
                makeBonus('2026-04', 25_000),
            ];
            expect(effectiveMonthlyRewardFromBase(280_000, '2026-04', bonuses)).toBe(305_000);
        });
    });

    describe('bonusesForStandardBonusPremium', () => {
        it('年4回以上の場合、標準賞与額の対象から除外する', () => {
            const monthBonuses = [makeBonus('2026-04', 20_000)];
            const allBonuses = [
                makeBonus('2026-01', 10_000),
                makeBonus('2026-02', 10_000),
                makeBonus('2026-03', 10_000),
                makeBonus('2026-04', 20_000),
            ];
            expect(bonusesForStandardBonusPremium(monthBonuses, '2026-04', allBonuses)).toEqual([]);
        });

        it('年3回以下の場合、標準賞与額の対象とする', () => {
            const monthBonuses = [makeBonus('2026-06', 200_000)];
            const allBonuses = [
                makeBonus('2026-06', 200_000),
                makeBonus('2026-12', 200_000),
            ];
            expect(bonusesForStandardBonusPremium(monthBonuses, '2026-06', allBonuses)).toEqual(
                monthBonuses,
            );
        });
    });
});
