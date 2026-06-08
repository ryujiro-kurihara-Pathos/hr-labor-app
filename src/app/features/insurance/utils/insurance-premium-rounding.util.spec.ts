import { roundInsurancePremium } from './insurance-premium-rounding.util';

describe('roundInsurancePremium', () => {
    it('50銭以下は切り捨てる', () => {
        expect(roundInsurancePremium(12345.4)).toBe(12345);
        expect(roundInsurancePremium(12345.5)).toBe(12345);
    });

    it('50銭超は切り上げる', () => {
        expect(roundInsurancePremium(12345.6)).toBe(12346);
    });
});
