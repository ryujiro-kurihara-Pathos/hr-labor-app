import {
    AUTOMATIC_INSURANCE_RATE_AVAILABLE_FROM,
    AUTOMATIC_INSURANCE_RATE_AVAILABLE_TO,
    DEFAULT_PENSION_INSURANCE_RATE,
    DEFAULT_PENSION_INSURANCE_TOTAL_RATE,
    healthInsuranceFiscalYearEndYearMonth,
    lookupAutomaticCareInsuranceRate,
    lookupAutomaticHealthInsuranceRate,
    lookupAutomaticPensionInsuranceRate,
    resolveAutomaticInsuranceRateAvailableTo,
    resolveInsurancePremiumRates,
} from './insurance-premium-rate-resolution.util';

describe('insurance-premium-rate-resolution.util', () => {
    const employee = {
        id: 'emp-1',
        prefecture: '東京都',
    } as Parameters<typeof lookupAutomaticHealthInsuranceRate>[0]['employee'];

    const office = {
        healthInsuranceType: 'kyokai',
        prefecture: '東京都',
    } as Parameters<typeof lookupAutomaticHealthInsuranceRate>[0]['office'];

    describe('lookupAutomaticHealthInsuranceRate', () => {
        it('returns rate for covered months', () => {
            const result = lookupAutomaticHealthInsuranceRate({
                liabilityYearMonth: '2024-06',
                office,
                employee,
            });
            expect(result).not.toBeNull();
            expect(result!.employeeRate).toBeGreaterThan(0);
            expect(result!.totalRate).toBeGreaterThan(result!.employeeRate);
        });

        it('returns null before data coverage', () => {
            const result = lookupAutomaticHealthInsuranceRate({
                liabilityYearMonth: '2023-12',
                office,
                employee,
            });
            expect(result).toBeNull();
        });
    });

    describe('lookupAutomaticPensionInsuranceRate', () => {
        it('returns default rate for covered months', () => {
            const result = lookupAutomaticPensionInsuranceRate('2024-06');
            expect(result?.employeeRate).toBe(DEFAULT_PENSION_INSURANCE_RATE);
            expect(result?.totalRate).toBe(DEFAULT_PENSION_INSURANCE_TOTAL_RATE);
        });

        it('returns null before data coverage', () => {
            expect(lookupAutomaticPensionInsuranceRate('2023-12')).toBeNull();
        });

        it('returns null after data coverage', () => {
            expect(lookupAutomaticPensionInsuranceRate('2027-03')).toBeNull();
        });
    });

    describe('resolveInsurancePremiumRates', () => {
        it('uses automatic rates when available', () => {
            const resolved = resolveInsurancePremiumRates({
                liabilityYearMonth: '2024-06',
                office,
                employee,
                manualRates: null,
            });
            expect(resolved.needsManualHealthRate).toBeFalse();
            expect(resolved.healthEmployeeRate).not.toBeNull();
            expect(resolved.healthTotalRate).not.toBeNull();
            expect(resolved.pensionEmployeeRate).toBe(DEFAULT_PENSION_INSURANCE_RATE);
            expect(resolved.pensionTotalRate).toBe(DEFAULT_PENSION_INSURANCE_TOTAL_RATE);
        });

        it('uses manual rates when automatic data is missing', () => {
            const resolved = resolveInsurancePremiumRates({
                liabilityYearMonth: '2023-12',
                office,
                employee,
                manualRates: {
                    id: 'x',
                    companyId: 'c1',
                    employeeId: 'emp-1',
                    liabilityYearMonth: '2023-12',
                    healthEmployeeRate: 0.05,
                    healthEmployerRate: 0.05,
                    careEmployeeRate: 0.008,
                    careEmployerRate: 0.008,
                    pensionEmployeeRate: 0.09,
                    pensionEmployerRate: 0.09,
                    createdAt: {} as never,
                    updatedAt: {} as never,
                },
            });
            expect(resolved.needsManualHealthRate).toBeTrue();
            expect(resolved.healthEmployeeRate).toBe(0.05);
            expect(resolved.pensionEmployeeRate).toBe(0.09);
        });

        it('flags missing manual rates before coverage month', () => {
            const resolved = resolveInsurancePremiumRates({
                liabilityYearMonth: '2023-12',
                office,
                employee,
                manualRates: null,
            });
            expect(resolved.needsManualHealthRate).toBeTrue();
            expect(resolved.needsManualCareRate).toBeTrue();
            expect(resolved.needsManualPensionRate).toBeTrue();
            expect(resolved.healthEmployeeRate).toBeNull();
        });
    });

    it('defines coverage start month', () => {
        expect(AUTOMATIC_INSURANCE_RATE_AVAILABLE_FROM).toBe('2024-03');
    });

    it('defines coverage end month at latest fiscal year February', () => {
        expect(healthInsuranceFiscalYearEndYearMonth(2026)).toBe('2027-02');
        expect(resolveAutomaticInsuranceRateAvailableTo()).toBe('2027-02');
        expect(AUTOMATIC_INSURANCE_RATE_AVAILABLE_TO).toBe('2027-02');
    });
});
