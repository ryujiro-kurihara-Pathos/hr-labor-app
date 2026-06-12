import {
    careInsurancePremiumEndYearMonth,
    computeCareInsurancePeriod,
    computeCareInsuranceEndDate,
    computeCareInsuranceStartDate,
    dayBeforeNthBirthday,
    isCareInsurancePremiumTargetMonth,
} from './care-insurance-period.util';

describe('care-insurance-period.util', () => {
    const birthDate = '1985-03-15';

    it('calculates day before 40th birthday', () => {
        expect(dayBeforeNthBirthday(birthDate, 40)).toBe('2025-03-14');
    });

    it('uses later date for care insurance start', () => {
        expect(computeCareInsuranceStartDate('2026-01-01', birthDate)).toBe('2026-01-01');
        expect(computeCareInsuranceStartDate('2020-01-01', birthDate)).toBe('2025-03-14');
    });

    it('uses earlier date for care insurance end', () => {
        expect(computeCareInsuranceEndDate('2030-06-30', birthDate)).toBe('2030-06-30');
        expect(computeCareInsuranceEndDate('2060-01-01', birthDate)).toBe('2050-03-14');
    });

    it('sets premium end month to month before loss date month', () => {
        expect(careInsurancePremiumEndYearMonth('2030-06-30')).toBe('2030-05');
    });

    it('determines premium target months from start and end months', () => {
        const period = computeCareInsurancePeriod('2026-04-01', '2030-06-30', birthDate);

        expect(period.startDate).toBe('2026-04-01');
        expect(period.premiumStartYearMonth).toBe('2026-04');
        expect(period.premiumEndYearMonth).toBe('2030-05');
        expect(
            isCareInsurancePremiumTargetMonth('2030-05', '2026-04-01', '2030-06-30', birthDate),
        ).toBeTrue();
        expect(
            isCareInsurancePremiumTargetMonth('2030-06', '2026-04-01', '2030-06-30', birthDate),
        ).toBeFalse();
    });
});
