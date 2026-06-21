import {
    formatPayrollDeductionNote,
    formatPremiumCollectionSummary,
    formatZeroPremiumBeforeEmploymentReason,
    insurancePremiumCollectionTimingLabel,
    isValidInsurancePremiumCollectionSetting,
    allowedInsurancePremiumCollectionTimings,
    lastDayOfMonth,
    resolveInsurancePremiumCollectionTiming,
    resolvePayrollDateInMonth,
    resolvePayrollDayInMonth,
    resolvePayrollDeductionYearMonth,
    resolvePremiumLiabilityYearMonth,
    resolvePremiumStandardDeterminationYearMonth,
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

    describe('resolvePremiumStandardDeterminationYearMonth', () => {
        it('uses liability month for same_month timing', () => {
            expect(resolvePremiumStandardDeterminationYearMonth('2026-09', 'same_month')).toBe('2026-09');
        });

        it('uses previous month of liability for next_month timing', () => {
            expect(resolvePremiumStandardDeterminationYearMonth('2026-09', 'next_month')).toBe('2026-08');
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
        it('returns default timing from payroll payment month offset', () => {
            expect(resolveInsurancePremiumCollectionTiming(0)).toBe('same_month');
            expect(resolveInsurancePremiumCollectionTiming(1)).toBe('next_month');
        });
    });

    describe('isValidInsurancePremiumCollectionSetting', () => {
        it('allows same month and next month collection when payroll is same month', () => {
            expect(isValidInsurancePremiumCollectionSetting(0, 'same_month')).toBeTrue();
            expect(isValidInsurancePremiumCollectionSetting(0, 'next_month')).toBeTrue();
        });

        it('allows only next month collection when payroll is next month', () => {
            expect(isValidInsurancePremiumCollectionSetting(1, 'next_month')).toBeTrue();
            expect(isValidInsurancePremiumCollectionSetting(1, 'same_month')).toBeFalse();
        });

        it('lists allowed timings per payroll payment month', () => {
            expect(allowedInsurancePremiumCollectionTimings(0)).toEqual(['same_month', 'next_month']);
            expect(allowedInsurancePremiumCollectionTimings(1)).toEqual(['next_month']);
        });
    });

    describe('resolvePremiumLiabilityYearMonth constraint', () => {
        it('never returns a liability month after the payroll deduction month', () => {
            for (const timing of ['same_month', 'next_month'] as const) {
                const payYearMonth = '2026-05';
                const liability = resolvePremiumLiabilityYearMonth(payYearMonth, timing);
                expect(liability <= payYearMonth).toBeTrue();
            }
        });
    });

    describe('insurancePremiumCollectionTimingLabel', () => {
        it('labels collection timing', () => {
            expect(insurancePremiumCollectionTimingLabel('same_month')).toBe('当月徴収');
            expect(insurancePremiumCollectionTimingLabel('next_month')).toBe('翌月徴収');
        });
    });

    describe('formatZeroPremiumBeforeEmploymentReason', () => {
        it('returns join month message when pay month is join month', () => {
            expect(
                formatZeroPremiumBeforeEmploymentReason({
                    payYearMonth: '2026-04',
                    joinYearMonth: '2026-04',
                    liabilityYearMonth: '2026-03',
                }),
            ).toBe(
                '2026年4月は入社月のため、この月の給与から控除する保険料はありません。2026年5月を選ぶと、2026年4月分の保険料が表示されます。',
            );
        });

        it('returns null when liability month is on or after join month', () => {
            expect(
                formatZeroPremiumBeforeEmploymentReason({
                    payYearMonth: '2026-05',
                    joinYearMonth: '2026-04',
                    liabilityYearMonth: '2026-04',
                }),
            ).toBeNull();
        });
    });
});
