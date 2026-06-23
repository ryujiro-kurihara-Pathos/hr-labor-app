import {
    clampYearMonth,
    formatYearMonth,
    listSelectableMonths,
    listSelectableYears,
    parseYearMonth,
} from './year-month-picker.util';

describe('year-month-picker.util', () => {
    it('lists months within min and max bounds', () => {
        expect(listSelectableMonths(2026, '2026-03', '2026-08')).toEqual([3, 4, 5, 6, 7, 8]);
        expect(listSelectableMonths(2025, '2026-03', '2026-08')).toEqual([]);
    });

    it('clamps year-month values', () => {
        expect(clampYearMonth('2026-01', '2026-03', '2026-08')).toBe('2026-03');
        expect(clampYearMonth('2026-12', '2026-03', '2026-08')).toBe('2026-08');
    });

    it('formats year-month values', () => {
        expect(formatYearMonth(2026, 6)).toBe('2026-06');
        expect(parseYearMonth('2026-06')).toEqual({ year: 2026, month: 6 });
    });

    it('lists selectable years from bounds', () => {
        expect(listSelectableYears('2024-01', '2026-12', 2026)).toEqual([2024, 2025, 2026]);
    });
});
