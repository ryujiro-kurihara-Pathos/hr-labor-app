import {
    formatPayrollDeductionNote,
    formatPremiumCollectionSummary,
    resolvePayrollDeductionYearMonth,
    resolvePremiumLiabilityYearMonth,
} from './company-payroll-settings.util';

describe('company-payroll-settings.util', () => {
    describe('resolvePremiumLiabilityYearMonth', () => {
        it('returns same month for same_month timing', () => {
            expect(resolvePremiumLiabilityYearMonth('2026-04', 'same_month')).toBe('2026-04');
        });

        it('returns previous month for next_month timing', () => {
            expect(resolvePremiumLiabilityYearMonth('2026-05', 'next_month')).toBe('2026-04');
        });
    });

    describe('resolvePayrollDeductionYearMonth', () => {
        it('returns display month as deduction month', () => {
            expect(resolvePayrollDeductionYearMonth('2026-05', 'next_month')).toBe('2026-05');
            expect(resolvePayrollDeductionYearMonth('2026-04', 'same_month')).toBe('2026-04');
        });
    });

    describe('formatPayrollDeductionNote', () => {
        it('describes payroll deduction month for next month collection', () => {
            expect(formatPayrollDeductionNote('2026-05', 'next_month')).toBe(
                '2026年5月の給与から控除（翌月徴収）',
            );
        });

        it('describes same month payroll deduction', () => {
            expect(formatPayrollDeductionNote('2026-04', 'same_month')).toBe(
                '2026年4月の給与から控除（当月徴収）',
            );
        });
    });

    describe('formatPremiumCollectionSummary', () => {
        it('explains next month collection from following payroll', () => {
            expect(formatPremiumCollectionSummary('2026-05', 'next_month')).toBe(
                '2026年4月分の保険料を、2026年5月の給与から控除します（翌月徴収）。',
            );
        });

        it('explains same month collection from same payroll', () => {
            expect(formatPremiumCollectionSummary('2026-04', 'same_month')).toBe(
                '2026年4月分の保険料を、2026年4月の給与から控除します（当月徴収）。',
            );
        });
    });
});
