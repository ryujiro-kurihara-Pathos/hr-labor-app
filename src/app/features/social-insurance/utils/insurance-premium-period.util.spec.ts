import {
    computeInsurancePremiumPeriod,
    isInsurancePremiumTargetMonth,
    lossDateFromRetirementDate,
    premiumEndYearMonthFromLossDate,
} from './insurance-premium-period.util';

describe('insurance-premium-period.util', () => {
    it('sets start month to acquisition month', () => {
        expect(
            computeInsurancePremiumPeriod('2026-04-15', null).premiumStartYearMonth,
        ).toBe('2026-04');
    });

    it('sets end month to month before loss date month', () => {
        expect(premiumEndYearMonthFromLossDate('2026-04-16')).toBe('2026-03');
        expect(premiumEndYearMonthFromLossDate('2026-05-01')).toBe('2026-04');
    });

    it('uses retirement date plus one day as loss date', () => {
        expect(lossDateFromRetirementDate('2026-04-15')).toBe('2026-04-16');
        expect(lossDateFromRetirementDate('2026-04-30')).toBe('2026-05-01');
    });

    it('excludes loss month from premium target months', () => {
        expect(
            isInsurancePremiumTargetMonth('2026-03', '2026-04-15', '2026-04-16'),
        ).toBeFalse();
        expect(
            isInsurancePremiumTargetMonth('2026-04', '2026-04-15', '2026-05-01'),
        ).toBeTrue();
    });
});
