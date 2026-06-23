const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export function parseYearMonth(value: string | null | undefined): { year: number; month: number } | null {
    if (!value) return null;
    const match = value.match(YEAR_MONTH_PATTERN);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
    return { year, month };
}

export function formatYearMonth(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
}

export function compareYearMonth(a: string, b: string): number {
    return a.localeCompare(b);
}

export function clampYearMonth(
    value: string,
    min: string | null | undefined,
    max: string | null | undefined,
): string {
    let result = value;
    if (min && compareYearMonth(result, min) < 0) result = min;
    if (max && compareYearMonth(result, max) > 0) result = max;
    return result;
}

export function listSelectableYears(
    min: string | null | undefined,
    max: string | null | undefined,
    fallbackYear: number,
): number[] {
    const minYear = parseYearMonth(min ?? '')?.year ?? fallbackYear - 10;
    const maxYear = parseYearMonth(max ?? '')?.year ?? fallbackYear + 1;
    const start = Math.min(minYear, maxYear);
    const end = Math.max(minYear, maxYear);
    const years: number[] = [];
    for (let year = start; year <= end; year++) {
        years.push(year);
    }
    return years;
}

export function listSelectableMonths(
    year: number,
    min: string | null | undefined,
    max: string | null | undefined,
): number[] {
    const minParsed = parseYearMonth(min ?? '');
    const maxParsed = parseYearMonth(max ?? '');

    if (minParsed && year < minParsed.year) return [];
    if (maxParsed && year > maxParsed.year) return [];

    let start = 1;
    let end = 12;

    if (minParsed && minParsed.year === year) {
        start = Math.max(start, minParsed.month);
    }
    if (maxParsed && maxParsed.year === year) {
        end = Math.min(end, maxParsed.month);
    }

    if (start > end) return [];

    const months: number[] = [];
    for (let month = start; month <= end; month++) {
        months.push(month);
    }
    return months;
}

export function formatYearMonthJa(value: string | null | undefined): string {
    const parsed = parseYearMonth(value ?? '');
    if (!parsed) return '—';
    return `${parsed.year}年${parsed.month}月`;
}
