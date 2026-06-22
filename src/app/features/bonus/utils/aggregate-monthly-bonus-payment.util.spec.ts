import { BonusReward } from '../models/bonus-reward.model';
import {
    aggregateMonthlyBonusPayment,
    calculateAggregatedStandardBonusAmount,
    MONTHLY_BONUS_PAYMENT_AGGREGATED_REMARK,
} from './aggregate-monthly-bonus-payment.util';

function bonus(overrides: Partial<BonusReward> = {}): BonusReward {
    return {
        id: 'b1',
        companyId: 'c1',
        employeeId: 'e1',
        paymentDate: '2026-06-10',
        targetYearMonth: '2026-06',
        bonusAmount: 100_000,
        standardBonusAmount: 100_000,
        status: 'confirmed',
        createdAt: {} as BonusReward['createdAt'],
        updatedAt: {} as BonusReward['updatedAt'],
        ...overrides,
    };
}

describe('aggregate-monthly-bonus-payment.util', () => {
    describe('calculateAggregatedStandardBonusAmount', () => {
        it('rounds down to nearest 1,000 yen', () => {
            expect(calculateAggregatedStandardBonusAmount(1_250_500)).toBe(1_250_000);
        });
    });

    describe('aggregateMonthlyBonusPayment', () => {
        it('aggregates multiple bonuses in the same month', () => {
            const aggregated = aggregateMonthlyBonusPayment(
                [
                    bonus({ id: 'b1', paymentDate: '2026-06-10', bonusAmount: 300_000 }),
                    bonus({ id: 'b2', paymentDate: '2026-06-25', bonusAmount: 250_500 }),
                ],
                '2026-06',
            );

            expect(aggregated?.targetYearMonth).toBe('2026-06');
            expect(aggregated?.paymentDate).toBe('2026-06-25');
            expect(aggregated?.firstPaymentDate).toBe('2026-06-10');
            expect(aggregated?.bonusAmountTotal).toBe(550_500);
            expect(aggregated?.standardBonusAmount).toBe(550_000);
            expect(aggregated?.remark).toBe(MONTHLY_BONUS_PAYMENT_AGGREGATED_REMARK);
            expect(aggregated?.isAggregated).toBeTrue();
            expect(aggregated?.bonuses.map((bonus) => bonus.id)).toEqual(['b1', 'b2']);
        });

        it('returns single bonus without aggregation remark', () => {
            const aggregated = aggregateMonthlyBonusPayment([bonus()], '2026-06');

            expect(aggregated?.paymentDate).toBe('2026-06-10');
            expect(aggregated?.firstPaymentDate).toBe('2026-06-10');
            expect(aggregated?.bonusAmountTotal).toBe(100_000);
            expect(aggregated?.remark).toBe('');
            expect(aggregated?.isAggregated).toBeFalse();
        });
    });
});
