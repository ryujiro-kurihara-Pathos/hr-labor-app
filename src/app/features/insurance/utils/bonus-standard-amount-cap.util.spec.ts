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

    it('翌月徴収でも前月賞与分を年度累計に含める（300万×2回）', () => {
        const april = bonus({
            id: 'april',
            targetYearMonth: '2026-04',
            standardBonusAmount: 3_000_000,
            paymentDate: '2026-04-25',
        });
        const may = bonus({
            id: 'may',
            targetYearMonth: '2026-05',
            standardBonusAmount: 3_000_000,
            paymentDate: '2026-05-25',
        });
        const allBonuses = [april, may];

        const aprilResult = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth: '2026-03',
            monthBonuses: [april],
            allBonuses,
        });
        const mayResult = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth: '2026-04',
            monthBonuses: [may],
            allBonuses,
        });

        expect(aprilResult.healthAndCare).toBe(3_000_000);
        expect(mayResult.healthAndCare).toBe(2_730_000);
        expect(aprilResult.healthAndCare + mayResult.healthAndCare).toBe(
            HEALTH_CARE_BONUS_STANDARD_AMOUNT_ANNUAL_CAP,
        );
    });

    it('600万×1回と300万×2回の健康保険対象額合計は同じ', () => {
        const single = bonus({
            id: 'single',
            targetYearMonth: '2026-04',
            standardBonusAmount: 6_000_000,
            paymentDate: '2026-04-25',
        });
        const april = bonus({
            id: 'april',
            targetYearMonth: '2026-04',
            standardBonusAmount: 3_000_000,
            paymentDate: '2026-04-10',
        });
        const may = bonus({
            id: 'may',
            targetYearMonth: '2026-05',
            standardBonusAmount: 3_000_000,
            paymentDate: '2026-05-25',
        });

        const singleResult = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth: '2026-03',
            monthBonuses: [single],
            allBonuses: [single],
        });
        const splitApril = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth: '2026-03',
            monthBonuses: [april],
            allBonuses: [april, may],
        });
        const splitMay = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth: '2026-04',
            monthBonuses: [may],
            allBonuses: [april, may],
        });

        expect(singleResult.healthAndCare).toBe(HEALTH_CARE_BONUS_STANDARD_AMOUNT_ANNUAL_CAP);
        expect(splitApril.healthAndCare + splitMay.healthAndCare).toBe(
            HEALTH_CARE_BONUS_STANDARD_AMOUNT_ANNUAL_CAP,
        );
    });

    it('同月複数回の健康保険は支給日順で上限を配分', () => {
        const first = bonus({
            id: 'first',
            targetYearMonth: '2026-06',
            standardBonusAmount: 4_000_000,
            paymentDate: '2026-06-10',
        });
        const second = bonus({
            id: 'second',
            targetYearMonth: '2026-06',
            standardBonusAmount: 2_000_000,
            paymentDate: '2026-06-25',
        });
        const allBonuses = [first, second];
        const result = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth: '2026-05',
            monthBonuses: [first, second],
            allBonuses,
        });

        expect(result.healthAndCare).toBe(HEALTH_CARE_BONUS_STANDARD_AMOUNT_ANNUAL_CAP);
        expect(result.healthAndCarePerBonus.get('first')).toBe(4_000_000);
        expect(result.healthAndCarePerBonus.get('second')).toBe(1_730_000);
    });

    it('年度は4月始まり', () => {
        expect(healthInsuranceFiscalYearStartYear('2026-03')).toBe(2025);
        expect(healthInsuranceFiscalYearStartYear('2026-04')).toBe(2026);
    });

    it('excludes bonuses paid on or after loss date from premium calculation', () => {
        const premiumable = bonus({
            id: 'in',
            targetYearMonth: '2026-06',
            standardBonusAmount: 100_000,
            paymentDate: '2026-06-30',
        });
        const nonPremiumable = bonus({
            id: 'out',
            targetYearMonth: '2026-07',
            standardBonusAmount: 200_000,
            paymentDate: '2026-07-15',
        });
        const allBonuses = [premiumable, nonPremiumable];

        const result = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth: '2026-07',
            monthBonuses: [nonPremiumable],
            allBonuses,
            insuredPeriodBounds: {
                qualificationDate: '2026-04-15',
                lossDate: '2026-07-01',
            },
        });

        expect(result.pension).toBe(0);
        expect(result.healthAndCare).toBe(0);
    });
});
