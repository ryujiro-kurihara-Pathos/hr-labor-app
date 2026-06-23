export type OfficeRegularWorkerCriteriaValues = {
    regularWeeklyScheduledWorkHours: number | null;
    regularMonthlyScheduledWorkDays: number | null;
};

type ParseSuccess = { ok: true; value: number | null };
type ParseFailure = { ok: false; error: string };
type ParseResult = ParseSuccess | ParseFailure;

export type OfficeRegularWorkerCriteriaValidationResult =
    | { ok: true; value: OfficeRegularWorkerCriteriaValues }
    | ParseFailure;

function normalizeInput(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

/** 週の所定労働時間（未入力可・小数可・0より大きい） */
export function parseRegularWeeklyScheduledWorkHours(
    value: string | number | null | undefined,
): ParseResult {
    const trimmed = normalizeInput(value);
    if (!trimmed) return { ok: true, value: null };

    const num = Number(trimmed);
    if (!Number.isFinite(num)) {
        return { ok: false, error: '週の所定労働時間は数値で入力してください' };
    }
    if (num <= 0) {
        return { ok: false, error: '週の所定労働時間は0より大きい値を入力してください' };
    }

    return { ok: true, value: num };
}

/** 月の所定労働日数（未入力可・整数のみ・0より大きい） */
export function parseRegularMonthlyScheduledWorkDays(
    value: string | number | null | undefined,
): ParseResult {
    const trimmed = normalizeInput(value);
    if (!trimmed) return { ok: true, value: null };

    const num = Number(trimmed);
    if (!Number.isFinite(num)) {
        return { ok: false, error: '月の所定労働日数は数値で入力してください' };
    }
    if (!Number.isInteger(num)) {
        return { ok: false, error: '月の所定労働日数は整数で入力してください' };
    }
    if (num <= 0) {
        return { ok: false, error: '月の所定労働日数は0より大きい値を入力してください' };
    }

    return { ok: true, value: num };
}

export function validateOfficeRegularWorkerCriteria(
    weeklyHours: string | number | null | undefined,
    monthlyDays: string | number | null | undefined,
): OfficeRegularWorkerCriteriaValidationResult {
    const weekly = parseRegularWeeklyScheduledWorkHours(weeklyHours);
    if (!weekly.ok) return weekly;

    const monthly = parseRegularMonthlyScheduledWorkDays(monthlyDays);
    if (!monthly.ok) return monthly;

    return {
        ok: true,
        value: {
            regularWeeklyScheduledWorkHours: weekly.value,
            regularMonthlyScheduledWorkDays: monthly.value,
        },
    };
}
