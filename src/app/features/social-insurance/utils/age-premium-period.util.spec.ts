import {
    computeHealthInsurancePremiumEndDate,
    computePensionInsurancePremiumEndDate,
    isHealthInsurancePremiumTargetMonth,
    isPensionInsurancePremiumTargetMonth,
} from './age-premium-period.util';

describe('age-premium-period.util', () => {
    const birthDate = '1956-06-15';

    it('sets health insurance premium end to month before 75th birthday eve', () => {
        expect(computeHealthInsurancePremiumEndDate(null, birthDate)).toBe('2031-06-14');
    });

    it('sets pension insurance premium end to month before 70th birthday eve', () => {
        expect(computePensionInsurancePremiumEndDate(null, birthDate)).toBe('2026-06-14');
    });

    it('calculates health insurance premium until 75 years old', () => {
        expect(
            isHealthInsurancePremiumTargetMonth(
                '2031-05',
                '2020-04-01',
                null,
                birthDate,
            ),
        ).toBeTrue();
        expect(
            isHealthInsurancePremiumTargetMonth(
                '2031-06',
                '2020-04-01',
                null,
                birthDate,
            ),
        ).toBeFalse();
    });

    it('calculates pension insurance premium until 70 years old', () => {
        expect(
            isPensionInsurancePremiumTargetMonth(
                '2026-05',
                '2020-04-01',
                null,
                null,
                null,
                birthDate,
            ),
        ).toBeTrue();
        expect(
            isPensionInsurancePremiumTargetMonth(
                '2026-06',
                '2020-04-01',
                null,
                null,
                null,
                birthDate,
            ),
        ).toBeFalse();
    });

    it('returns zero pension premium month when only health enrollment remains', () => {
        expect(
            isPensionInsurancePremiumTargetMonth(
                '2028-01',
                '2020-04-01',
                null,
                null,
                null,
                birthDate,
            ),
        ).toBeFalse();
        expect(
            isHealthInsurancePremiumTargetMonth(
                '2028-01',
                '2020-04-01',
                null,
                birthDate,
            ),
        ).toBeTrue();
    });
});
