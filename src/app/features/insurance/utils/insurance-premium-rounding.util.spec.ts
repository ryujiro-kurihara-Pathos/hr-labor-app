import {
    calculateInsurancePremiumShares,
    roundInsurancePremium,
} from './insurance-premium-rounding.util';

describe('roundInsurancePremium', () => {
    it('50銭以下は切り捨てる', () => {
        expect(roundInsurancePremium(12345.4)).toBe(12345);
        expect(roundInsurancePremium(12345.5)).toBe(12345);
    });

    it('50銭超は切り上げる', () => {
        expect(roundInsurancePremium(12345.6)).toBe(12346);
    });
});

describe('calculateInsurancePremiumShares', () => {
    it('本人負担のみ端数処理し、会社負担は保険料全体から差し引く', () => {
        const shares = calculateInsurancePremiumShares(19_999, 1);

        expect(shares.totalPremium).toBe(19_999);
        expect(shares.employeePremium).toBe(9_999);
        expect(shares.employerPremium).toBe(10_000);
    });

    it('本人と会社の合計が保険料全体と一致する', () => {
        const shares = calculateInsurancePremiumShares(410_000, 0.0991);

        expect(shares.employeePremium + shares.employerPremium).toBe(shares.totalPremium);
    });
});
