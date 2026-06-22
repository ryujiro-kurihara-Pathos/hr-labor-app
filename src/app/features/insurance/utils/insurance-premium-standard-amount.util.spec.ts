import { StandardMonthlyRewardCalculatorService } from '../services/standard-monthly-reward-calculator.service';
import { resolveMonthlyPremiumStandardAmounts } from './insurance-premium-standard-amount.util';

describe('insurance-premium-standard-amount.util', () => {
    const calculator = new StandardMonthlyRewardCalculatorService();

    it('uses health table for health/care and pension table for pension', () => {
        const calculation = calculator.calculate(700_000);
        expect(calculation.health?.standardMonthlyAmount).toBe(710_000);
        expect(calculation.pension?.standardMonthlyAmount).toBe(650_000);

        expect(resolveMonthlyPremiumStandardAmounts(calculation)).toEqual({
            health: 710_000,
            pension: 650_000,
            care: 710_000,
        });
    });

    it('returns null amounts when calculation is incomplete', () => {
        expect(resolveMonthlyPremiumStandardAmounts(null)).toEqual({
            health: null,
            pension: null,
            care: null,
        });
    });
});
