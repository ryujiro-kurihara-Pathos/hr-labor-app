import {
    DEPENDENT_ANNUAL_INCOME_LIMIT_SENIOR_OR_DISABLED,
    DEPENDENT_ANNUAL_INCOME_LIMIT_STANDARD,
    DEPENDENT_ANNUAL_INCOME_LIMIT_YOUNG_ADULT,
    ageAtReferenceDate,
    dependentAddIncomeBlockReason,
    evaluateDependentIncomeEligibility,
    resolveDependentIncomeLimit,
} from './dependent-income-eligibility.util';

describe('dependent-income-eligibility.util', () => {
    describe('resolveDependentIncomeLimit', () => {
        it('uses 130万 for standard case', () => {
            const result = resolveDependentIncomeLimit({
                birthDate: '1990-01-01',
                referenceDate: '2026-06-01',
                isDisabled: false,
            });
            expect(result.limit).toBe(DEPENDENT_ANNUAL_INCOME_LIMIT_STANDARD);
        });

        it('uses 150万 for ages 19-22', () => {
            const result = resolveDependentIncomeLimit({
                birthDate: '2006-06-01',
                referenceDate: '2026-06-01',
                isDisabled: false,
            });
            expect(result.limit).toBe(DEPENDENT_ANNUAL_INCOME_LIMIT_YOUNG_ADULT);
        });

        it('uses 180万 for age 60 or older', () => {
            const result = resolveDependentIncomeLimit({
                birthDate: '1960-01-01',
                referenceDate: '2026-06-01',
                isDisabled: false,
            });
            expect(result.limit).toBe(DEPENDENT_ANNUAL_INCOME_LIMIT_SENIOR_OR_DISABLED);
        });

        it('uses 180万 when disabled regardless of age', () => {
            const result = resolveDependentIncomeLimit({
                birthDate: '2006-06-01',
                referenceDate: '2026-06-01',
                isDisabled: true,
            });
            expect(result.limit).toBe(DEPENDENT_ANNUAL_INCOME_LIMIT_SENIOR_OR_DISABLED);
        });
    });

    describe('evaluateDependentIncomeEligibility', () => {
        it('is eligible below the limit', () => {
            const result = evaluateDependentIncomeEligibility({
                annualIncome: 1_200_000,
                birthDate: '1990-01-01',
                referenceDate: '2026-06-01',
                isDisabled: false,
            });
            expect(result.eligible).toBeTrue();
        });

        it('is ineligible at or above the standard limit', () => {
            const result = evaluateDependentIncomeEligibility({
                annualIncome: 1_300_000,
                birthDate: '1990-01-01',
                referenceDate: '2026-06-01',
                isDisabled: false,
            });
            expect(result.eligible).toBeFalse();
            expect(result.reason).toContain('扶養対象外');
        });

        it('uses 150万 threshold for ages 19-22', () => {
            const eligible = evaluateDependentIncomeEligibility({
                annualIncome: 1_499_999,
                birthDate: '2006-06-01',
                referenceDate: '2026-06-01',
                isDisabled: false,
            });
            expect(eligible.eligible).toBeTrue();

            const ineligible = evaluateDependentIncomeEligibility({
                annualIncome: 1_500_000,
                birthDate: '2006-06-01',
                referenceDate: '2026-06-01',
                isDisabled: false,
            });
            expect(ineligible.eligible).toBeFalse();
            expect(ineligible.limit.limit).toBe(DEPENDENT_ANNUAL_INCOME_LIMIT_YOUNG_ADULT);
        });
    });

    describe('dependentAddIncomeBlockReason', () => {
        it('returns null when income is below the limit', () => {
            expect(
                dependentAddIncomeBlockReason({
                    annualIncome: 1_000_000,
                    birthDate: '1990-01-01',
                    referenceDate: '2026-06-01',
                    isDisabled: false,
                }),
            ).toBeNull();
        });

        it('blocks add procedure when income is at or above the limit', () => {
            const reason = dependentAddIncomeBlockReason({
                annualIncome: 1_800_000,
                birthDate: '1960-01-01',
                referenceDate: '2026-06-01',
                isDisabled: false,
            });
            expect(reason).toContain('扶養追加届は作成できません');
        });
    });

    describe('ageAtReferenceDate', () => {
        it('calculates age before birthday in reference year', () => {
            expect(ageAtReferenceDate('2006-12-01', '2026-06-01')).toBe(19);
        });
    });
});
