import {
    formatPayrollDeductionNote,
    formatPremiumCollectionSummary,
    insurancePremiumCollectionTimingLabel,
    lastDayOfMonth,
    resolveInsurancePremiumCollectionTiming,
    resolvePayrollDateInMonth,
    resolvePayrollDayInMonth,
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

    describe('resolvePayrollDayInMonth', () => {
        it('uses the last day when configured day exceeds month length', () => {
            expect(resolvePayrollDayInMonth(31, 2026, 4)).toBe(30);
            expect(resolvePayrollDayInMonth(31, 2026, 2)).toBe(28);
            expect(resolvePayrollDayInMonth(30, 2026, 2)).toBe(28);
        });

        it('keeps configured day when it exists in the month', () => {
            expect(resolvePayrollDayInMonth(15, 2026, 4)).toBe(15);
            expect(resolvePayrollDayInMonth(31, 2026, 1)).toBe(31);
        });

        it('resolves configured date string for a year month', () => {
            expect(resolvePayrollDateInMonth(31, 2026, 4)).toBe('2026-04-30');
            expect(lastDayOfMonth(2026, 4)).toBe(30);
        });
    });

    describe('resolveInsurancePremiumCollectionTiming', () => {
        it('follows payroll payment month offset', () => {
            expect(resolveInsurancePremiumCollectionTiming(0)).toBe('same_month');
            expect(resolveInsurancePremiumCollectionTiming(1)).toBe('next_month');
        });
    });

    describe('insurancePremiumCollectionTimingLabel', () => {
        it('labels collection timing', () => {
            expect(insurancePremiumCollectionTimingLabel('same_month')).toBe('当月徴収');
            expect(insurancePremiumCollectionTimingLabel('next_month')).toBe('翌月徴収');
        });
    });
});
