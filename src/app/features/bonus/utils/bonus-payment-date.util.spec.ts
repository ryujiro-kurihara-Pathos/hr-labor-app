import { BonusReward } from '../models/bonus-reward.model';
import {
    resolveDefaultBonusPaymentDate,
    validateBonusPaymentDateDuplicate,
} from './bonus-payment-date.util';

function bonus(paymentDate: string): BonusReward {
    return {
        id: `b_${paymentDate}`,
        companyId: 'c1',
        employeeId: 'e1',
        paymentDate,
        targetYearMonth: '2026-06',
        bonusAmount: 100_000,
        standardBonusAmount: 100_000,
        createdAt: {} as BonusReward['createdAt'],
        updatedAt: {} as BonusReward['updatedAt'],
    };
}

describe('bonus-payment-date.util', () => {
    describe('resolveDefaultBonusPaymentDate', () => {
        it('returns first unused date within bounds', () => {
            expect(
                resolveDefaultBonusPaymentDate({
                    targetYearMonth: '2026-06',
                    minDate: '2026-06-10',
                    maxDate: '2026-06-12',
                    usedPaymentDates: ['2026-06-10'],
                }),
            ).toBe('2026-06-11');
        });

        it('returns max when all dates are used', () => {
            expect(
                resolveDefaultBonusPaymentDate({
                    targetYearMonth: '2026-06',
                    minDate: '2026-06-10',
                    maxDate: '2026-06-11',
                    usedPaymentDates: ['2026-06-10', '2026-06-11'],
                }),
            ).toBe('2026-06-11');
        });
    });

    describe('validateBonusPaymentDateDuplicate', () => {
        it('blocks duplicate payment date for new bonus', () => {
            const reason = validateBonusPaymentDateDuplicate({
                paymentDate: '2026-06-10',
                monthBonuses: [bonus('2026-06-10')],
            });
            expect(reason).toContain('既に登録');
        });

        it('allows same date when editing existing bonus', () => {
            const reason = validateBonusPaymentDateDuplicate({
                paymentDate: '2026-06-10',
                monthBonuses: [bonus('2026-06-10')],
                editingPaymentDate: '2026-06-10',
            });
            expect(reason).toBeNull();
        });
    });
});
