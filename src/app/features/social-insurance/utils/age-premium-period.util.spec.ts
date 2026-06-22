import {
    computeHealthInsurancePremiumEndDate,
    computePensionInsurancePremiumEndDate,
    isHealthInsurancePremiumTargetMonth,
    isPensionInsurancePremiumTargetMonth,
    judgeHealthInsuranceJoinStatus,
    judgePensionInsuranceJoinStatus,
} from './age-premium-period.util';

describe('age-premium-period.util', () => {
    const birthDate = '1956-06-15';

    it('sets health insurance premium end to 75th birthday', () => {
        expect(computeHealthInsurancePremiumEndDate(null, birthDate)).toBe('2031-06-15');
    });

    it('calculates health insurance premium until month before 75th birthday month', () => {
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

    it('uses 75th birthday for first-of-month birth when calculating health premium end', () => {
        const firstOfMonthBirth = '1956-03-01';
        expect(computeHealthInsurancePremiumEndDate(null, firstOfMonthBirth)).toBe('2031-03-01');
        expect(
            isHealthInsurancePremiumTargetMonth(
                '2031-02',
                '2020-04-01',
                null,
                firstOfMonthBirth,
            ),
        ).toBeTrue();
        expect(
            isHealthInsurancePremiumTargetMonth(
                '2031-03',
                '2020-04-01',
                null,
                firstOfMonthBirth,
            ),
        ).toBeFalse();
    });

    it('sets pension insurance premium end to month before 70th birthday eve', () => {
        expect(computePensionInsurancePremiumEndDate(null, birthDate)).toBe('2026-06-14');
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

    it('marks pension join status inactive when employment is active but age is 70 or over', () => {
        const birthDate72 = '1954-01-15';
        expect(judgePensionInsuranceJoinStatus('active', birthDate72)).toBe('inactive');
        expect(judgeHealthInsuranceJoinStatus('active', birthDate72)).toBe('active');
    });

    it('keeps join status inactive when employment is inactive regardless of age', () => {
        expect(judgePensionInsuranceJoinStatus('inactive', '1990-01-01')).toBe('inactive');
    });
});
