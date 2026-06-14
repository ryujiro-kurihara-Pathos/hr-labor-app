import {
    formatPayrollDeductionNote,
    resolvePayrollDeductionYearMonth,
} from './company-payroll-settings.util';

describe('company-payroll-settings.util', () => {
    describe('resolvePayrollDeductionYearMonth', () => {
        it('returns same month for same_month timing', () => {
            expect(resolvePayrollDeductionYearMonth('2026-04', 'same_month')).toBe('2026-04');
        });

        it('returns next month for next_month timing', () => {
            expect(resolvePayrollDeductionYearMonth('2026-04', 'next_month')).toBe('2026-05');
        });
    });

    describe('formatPayrollDeductionNote', () => {
        it('describes next month payroll deduction', () => {
            expect(formatPayrollDeductionNote('2026-04', 'next_month')).toBe(
                '2026年5月の給与から控除（翌月徴収）',
            );
        });

        it('describes same month payroll deduction', () => {
            expect(formatPayrollDeductionNote('2026-04', 'same_month')).toBe(
                '2026年4月の給与から控除（当月徴収）',
            );
        });
    });
});
