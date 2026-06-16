import { BonusReward } from '../../bonus/models/bonus-reward.model';
import {
    HEALTH_CARE_BONUS_STANDARD_AMOUNT_ANNUAL_CAP,
    PENSION_BONUS_STANDARD_AMOUNT_MONTHLY_CAP,
    healthInsuranceFiscalYearStartYear,
    resolveBonusPremiumableStandardAmounts,
} from './bonus-standard-amount-cap.util';

function bonus(overrides: Partial<BonusReward> & Pick<BonusReward, 'id' | 'targetYearMonth' | 'standardBonusAmount'>): BonusReward {
    return {
        companyId: 'c1',
        employeeId: 'e1',
        paymentDate: `${overrides.targetYearMonth}-25`,
        bonusAmount: overrides.standardBonusAmount,
        status: 'confirmed',
        createdAt: {} as BonusReward['createdAt'],
        updatedAt: {} as BonusReward['updatedAt'],
        ...overrides,
    };
}

describe('bonus-standard-amount-cap.util', () => {
    it('厚生年金は同月合算で150万円まで', () => {
        const monthBonuses = [
            bonus({ id: 'b1', targetYearMonth: '2026-06', standardBonusAmount: 2_000_000, paymentDate: '2026-06-10' }),
        ];
        const result = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth: '2026-06',
            monthBonuses,
            allBonuses: monthBonuses,
        });

        expect(result.pension).toBe(PENSION_BONUS_STANDARD_AMOUNT_MONTHLY_CAP);
        expect(result.healthAndCare).toBe(2_000_000);
    });

    it('同月複数回の厚生年金は合算して150万円まで', () => {
        const monthBonuses = [
            bonus({ id: 'b1', targetYearMonth: '2026-06', standardBonusAmount: 1_000_000, paymentDate: '2026-06-10' }),
            bonus({ id: 'b2', targetYearMonth: '2026-06', standardBonusAmount: 1_000_000, paymentDate: '2026-06-25' }),
        ];
        const result = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth: '2026-06',
            monthBonuses,
            allBonuses: monthBonuses,
        });

        expect(result.pension).toBe(PENSION_BONUS_STANDARD_AMOUNT_MONTHLY_CAP);
    });

    it('健康保険・介護保険は年度累計573万円まで', () => {
        const prior = bonus({
            id: 'prior',
            targetYearMonth: '2026-04',
            standardBonusAmount: 4_000_000,
            paymentDate: '2026-04-25',
        });
        const current = bonus({
            id: 'current',
            targetYearMonth: '2026-12',
            standardBonusAmount: 2_000_000,
            paymentDate: '2026-12-10',
        });
        const allBonuses = [prior, current];
        const result = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth: '2026-12',
            monthBonuses: [current],
            allBonuses,
        });

        expect(result.healthAndCare).toBe(HEALTH_CARE_BONUS_STANDARD_AMOUNT_ANNUAL_CAP - 4_000_000);
        expect(result.healthAndCarePerBonus.get('current')).toBe(1_730_000);
    });

    it('年度は4月始まり', () => {
        expect(healthInsuranceFiscalYearStartYear('2026-03')).toBe(2025);
        expect(healthInsuranceFiscalYearStartYear('2026-04')).toBe(2026);
    });
});
