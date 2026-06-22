import { BonusReward } from '../models/bonus-reward.model';

/** 同月内で未使用の支給日を返す（すべて使用中なら max を返す） */
export function resolveDefaultBonusPaymentDate(params: {
    targetYearMonth: string;
    minDate: string | null;
    maxDate: string | null;
    usedPaymentDates: string[];
}): string {
    const { targetYearMonth, minDate, maxDate, usedPaymentDates } = params;
    const used = new Set(usedPaymentDates);
    const start = minDate ?? `${targetYearMonth}-01`;
    const end = maxDate ?? start;

    let candidate = start;
    while (candidate <= end) {
        if (!used.has(candidate)) return candidate;
        candidate = addDaysToDateString(candidate, 1);
    }

    return end;
}

export function validateBonusPaymentDateDuplicate(params: {
    paymentDate: string;
    monthBonuses: BonusReward[];
    editingPaymentDate?: string | null;
}): string | null {
    const editing = params.editingPaymentDate?.trim();
    const duplicate = params.monthBonuses.some(
        (bonus) =>
            bonus.paymentDate === params.paymentDate
            && bonus.paymentDate !== editing,
    );
    if (duplicate) {
        return 'この支給日の賞与は既に登録されています。別の支給日を指定してください。';
    }
    return null;
}

function addDaysToDateString(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const next = new Date(year, month - 1, day + days);
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, '0');
    const d = String(next.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
