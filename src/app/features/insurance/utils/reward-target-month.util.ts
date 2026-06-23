import { Timestamp } from 'firebase/firestore';

import {
    APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
    InsurancePremiumCollectionTiming,
} from '../../company/models/company.model';
import { Employee } from '../../employee/models/employee.models';
import {
    resolveInsuredPeriodBounds,
    validateDateWithinInsuredPeriod,
} from '../../social-insurance/utils/procedure-date-range.util';
import { premiumEndYearMonthFromLossDate } from '../../social-insurance/utils/insurance-premium-period.util';
import {
    AUTOMATIC_INSURANCE_RATE_AVAILABLE_FROM,
    AUTOMATIC_INSURANCE_RATE_AVAILABLE_TO,
} from './insurance-premium-rate-resolution.util';

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function yearMonthFromDateString(date: string | null | undefined): string | null {
    if (!date || date.length < 7) return null;
    const ym = date.slice(0, 7);
    return YEAR_MONTH_PATTERN.test(ym) ? ym : null;
}

export function yearMonthFromTimestamp(ts: Timestamp | null | undefined): string | null {
    if (!ts) return null;
    const d = ts.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

export function dateStringFromTimestamp(ts: Timestamp | null | undefined): string | null {
    if (!ts) return null;
    const d = ts.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** 日付が入社日以降かつ退職日以前（在籍中は退職日チェックなし） */
export function isDateWithinEmploymentPeriod(employee: Employee, date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

    const joinedDate = employee.joinedDate?.trim();
    if (joinedDate && date < joinedDate) return false;

    const retiredDate = dateStringFromTimestamp(employee.retiredDate);
    if (retiredDate && date > retiredDate) return false;

    return true;
}

export function employmentPeriodDateReason(employee: Employee, date: string): string | null {
    if (isDateWithinEmploymentPeriod(employee, date)) return null;

    const joinedDate = employee.joinedDate?.trim();
    if (joinedDate && date < joinedDate) {
        return `${formatDateLabel(joinedDate)}入社のため、この日付は対象外です。`;
    }

    const retiredDate = dateStringFromTimestamp(employee.retiredDate);
    if (retiredDate && date > retiredDate) {
        return `${formatDateLabel(retiredDate)}退職のため、この日付は対象外です。`;
    }

    return '在籍期間外の日付です。';
}

/** 退職者の報酬・賞与入力における勤務月上限（退職月の翌月まで） */
export function rewardInputMaxWorkYearMonthFromRetirement(
    retiredDate: Timestamp | null | undefined,
): string | null {
    const retireYm = yearMonthFromTimestamp(retiredDate);
    if (!retireYm) return null;
    return addMonthsToYearMonth(retireYm, 1);
}

/** 賞与支給日が社会保険料の対象か（資格取得日以上・資格喪失日未満） */
export function isBonusPaymentDatePremiumable(
    employee: Employee,
    paymentDate: string,
    insuranceDates?: {
        healthInsuranceStartDate?: string | null;
        healthInsuranceEndDate?: string | null;
    },
): boolean {
    if (!isBonusPaymentDateAllowed(employee, paymentDate, insuranceDates)) return false;

    const bounds = resolveInsuredPeriodBounds({
        employee,
        healthInsuranceStartDate: insuranceDates?.healthInsuranceStartDate,
        healthInsuranceEndDate: insuranceDates?.healthInsuranceEndDate,
    });
    return validateDateWithinInsuredPeriod(paymentDate, bounds) === null;
}

/** 賞与支給日が入力可能な期間か（対象年月。資格喪失日以降も入力可だが保険料対象外） */
export function isBonusPaymentDateAllowed(
    employee: Employee,
    paymentDate: string,
    insuranceDates?: {
        healthInsuranceStartDate?: string | null;
        healthInsuranceEndDate?: string | null;
    },
): boolean {
    const targetYearMonth = yearMonthFromDateString(paymentDate);
    if (!targetYearMonth || !isRewardTargetMonth(employee, targetYearMonth)) return false;

    const bounds = resolveInsuredPeriodBounds({
        employee,
        healthInsuranceStartDate: insuranceDates?.healthInsuranceStartDate,
        healthInsuranceEndDate: insuranceDates?.healthInsuranceEndDate,
    });
    const qualification = bounds.qualificationDate?.trim();
    if (qualification && paymentDate < qualification) return false;

    const retiredDate = dateStringFromTimestamp(employee.retiredDate);
    const retireYm = yearMonthFromTimestamp(employee.retiredDate);
    if (retiredDate && retireYm && targetYearMonth === retireYm && paymentDate > retiredDate) {
        return false;
    }

    return true;
}

export function bonusPaymentDateReason(
    employee: Employee,
    paymentDate: string,
    insuranceDates?: {
        healthInsuranceStartDate?: string | null;
        healthInsuranceEndDate?: string | null;
    },
): string | null {
    const targetYearMonth = yearMonthFromDateString(paymentDate);
    if (!targetYearMonth) return '支給日の形式が正しくありません。';

    const monthReason = rewardTargetMonthReason(employee, targetYearMonth);
    if (monthReason) return monthReason;

    const bounds = resolveInsuredPeriodBounds({
        employee,
        healthInsuranceStartDate: insuranceDates?.healthInsuranceStartDate,
        healthInsuranceEndDate: insuranceDates?.healthInsuranceEndDate,
    });
    const qualification = bounds.qualificationDate?.trim();
    if (qualification && paymentDate < qualification) {
        return `資格取得日（${formatDateLabel(qualification)}）以降の日付を指定してください。`;
    }

    const retiredDate = dateStringFromTimestamp(employee.retiredDate);
    const retireYm = yearMonthFromTimestamp(employee.retiredDate);
    if (retiredDate && retireYm && targetYearMonth === retireYm && paymentDate > retiredDate) {
        return `${formatDateLabel(retiredDate)}退職のため、この日付は対象外です。`;
    }

    return null;
}

export function currentYearMonth(date: Date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function minYearMonth(a: string, b: string): string {
    return a <= b ? a : b;
}

function maxYearMonth(a: string, b: string): string {
    return a >= b ? a : b;
}

/** 保険料の給与控除月の上限（翌月徴収は根拠月+1まで） */
export function insuranceRatePremiumDeductYearMonthMax(
    timing: InsurancePremiumCollectionTiming,
): string {
    if (timing === 'next_month') {
        return addMonthsToYearMonth(AUTOMATIC_INSURANCE_RATE_AVAILABLE_TO, 1);
    }
    return AUTOMATIC_INSURANCE_RATE_AVAILABLE_TO;
}

/** 一覧画面の月ナビ下限（過去60か月と料率データ開始月の遅い方） */
export function listNavigableYearMonthMin(
    referenceYearMonth: string = currentYearMonth(),
): string {
    const backwardLimit = addMonthsToYearMonth(referenceYearMonth, -60);
    return maxYearMonth(backwardLimit, AUTOMATIC_INSURANCE_RATE_AVAILABLE_FROM);
}

/** 一覧画面の月ナビ上限（翌月先行入力と料率データ終了月の早い方） */
export function listNavigableYearMonthMax(
    referenceYearMonth: string = currentYearMonth(),
): string {
    const forwardLimit = addMonthsToYearMonth(referenceYearMonth, 1);
    return minYearMonth(forwardLimit, AUTOMATIC_INSURANCE_RATE_AVAILABLE_TO);
}

/** 給与入力の上限：現在月の翌月。退職予定月の翌月がそれより前なら退職月の翌月まで */
export function inputableYearMonthMax(employee: Employee, referenceYearMonth: string): string {
    let forwardLimit = addMonthsToYearMonth(referenceYearMonth, 1);
    if (forwardLimit > AUTOMATIC_INSURANCE_RATE_AVAILABLE_TO) {
        forwardLimit = AUTOMATIC_INSURANCE_RATE_AVAILABLE_TO;
    }
    const retireMax = rewardInputMaxWorkYearMonthFromRetirement(employee.retiredDate);
    if (retireMax && retireMax < forwardLimit) return retireMax;
    return forwardLimit;
}

/** 報酬入力の上限（後方互換の別名） */
export function viewableYearMonthMax(employee: Employee, referenceYearMonth: string): string {
    return inputableYearMonthMax(employee, referenceYearMonth);
}

/**
 * 保険料閲覧の上限。
 * 当月徴収は報酬入力と同じ。翌月徴収はさらに1か月先まで（控除月＝根拠月+1のため）。
 * 確定済み報酬がある場合は、その翌月控除分まで閲覧可能にする。
 */
export function premiumViewableYearMonthMax(
    employee: Employee,
    referenceYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
    latestConfirmedWorkYearMonth: string | null = null,
): string {
    const calendarMax = premiumViewableYearMonthMaxFromCalendar(
        employee,
        referenceYearMonth,
        timing,
    );
    if (!latestConfirmedWorkYearMonth) return calendarMax;

    const ratePremiumCap = insuranceRatePremiumDeductYearMonthMax(timing);
    const rewardMax = minYearMonth(
        premiumDeductYearMonthForWorkMonth(latestConfirmedWorkYearMonth, timing),
        ratePremiumCap,
    );
    return rewardMax > calendarMax ? rewardMax : calendarMax;
}

/** 勤務月に対応する保険料の給与控除月 */
export function premiumDeductYearMonthForWorkMonth(
    workYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
): string {
    return timing === 'next_month'
        ? addMonthsToYearMonth(workYearMonth, 1)
        : workYearMonth;
}

function premiumViewableYearMonthMaxFromCalendar(
    employee: Employee,
    referenceYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
): string {
    if (timing === 'same_month') {
        return inputableYearMonthMax(employee, referenceYearMonth);
    }

    const inputMax = inputableYearMonthMax(employee, referenceYearMonth);
    let premiumMax = addMonthsToYearMonth(inputMax, 1);

    const insuredBounds = resolveInsuredPeriodBounds({ employee });
    const premiumEndWorkYm = premiumEndYearMonthFromLossDate(insuredBounds.lossDate);
    if (premiumEndWorkYm) {
        const lossBasedCap = premiumDeductYearMonthForWorkMonth(premiumEndWorkYm, timing);
        if (premiumMax > lossBasedCap) premiumMax = lossBasedCap;
    }

    const ratePremiumCap = insuranceRatePremiumDeductYearMonthMax(timing);
    if (premiumMax > ratePremiumCap) premiumMax = ratePremiumCap;

    return premiumMax;
}

export type YearMonthNavigationScope = 'reward_input' | 'premium_view';

/** 月ナビの上限（報酬入力 or 保険料閲覧） */
export function navigableYearMonthMax(
    employee: Employee,
    referenceYearMonth: string = currentYearMonth(),
    scope: YearMonthNavigationScope = 'reward_input',
    timing: InsurancePremiumCollectionTiming = APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
    latestConfirmedWorkYearMonth: string | null = null,
): string {
    if (scope === 'premium_view') {
        return premiumViewableYearMonthMax(
            employee,
            referenceYearMonth,
            timing,
            latestConfirmedWorkYearMonth,
        );
    }
    return inputableYearMonthMax(employee, referenceYearMonth);
}

export function viewableYearMonthMin(employee: Employee): string | null {
    return yearMonthFromDateString(employee.joinedDate);
}

/** 報酬入力の範囲内か */
export function isViewableYearMonth(
    employee: Employee,
    targetYearMonth: string,
    referenceYearMonth: string,
): boolean {
    return isRewardTargetMonth(employee, targetYearMonth, referenceYearMonth);
}

/** 保険料閲覧の範囲内か */
export function isPremiumViewableYearMonth(
    employee: Employee,
    targetYearMonth: string,
    referenceYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
    latestConfirmedWorkYearMonth: string | null = null,
): boolean {
    if (!YEAR_MONTH_PATTERN.test(targetYearMonth)) return false;

    const joinYm = yearMonthFromDateString(employee.joinedDate);
    if (joinYm && targetYearMonth < joinYm) return false;

    if (
        targetYearMonth
        > premiumViewableYearMonthMax(
            employee,
            referenceYearMonth,
            timing,
            latestConfirmedWorkYearMonth,
        )
    ) {
        return false;
    }

    return true;
}

export function clampViewableYearMonth(
    employee: Employee,
    targetYearMonth: string,
    currentYearMonth: string,
): string {
    return clampNavigableYearMonth(employee, targetYearMonth, currentYearMonth, {
        scope: 'reward_input',
    });
}

export function clampNavigableYearMonth(
    employee: Employee,
    targetYearMonth: string,
    referenceYearMonth: string,
    options: {
        scope: YearMonthNavigationScope;
        timing?: InsurancePremiumCollectionTiming;
        latestConfirmedWorkYearMonth?: string | null;
    },
): string {
    const minYm = viewableYearMonthMin(employee);
    const maxYm = navigableYearMonthMax(
        employee,
        referenceYearMonth,
        options.scope,
        options.timing ?? APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
        options.latestConfirmedWorkYearMonth ?? null,
    );
    let ym = targetYearMonth;
    if (minYm && ym < minYm) ym = minYm;
    if (ym > maxYm) ym = maxYm;
    return ym;
}

export function clampPremiumViewableYearMonth(
    employee: Employee,
    targetYearMonth: string,
    referenceYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
    latestConfirmedWorkYearMonth: string | null = null,
): string {
    return clampNavigableYearMonth(employee, targetYearMonth, referenceYearMonth, {
        scope: 'premium_view',
        timing,
        latestConfirmedWorkYearMonth,
    });
}

export function listViewableYearMonths(employee: Employee, currentYearMonth: string): string[] {
    const minYm = viewableYearMonthMin(employee);
    const maxYm = viewableYearMonthMax(employee, currentYearMonth);
    if (!minYm) return [];

    const months: string[] = [];
    let ym = minYm;
    while (ym <= maxYm) {
        months.push(ym);
        ym = addMonthsToYearMonth(ym, 1);
    }
    return months;
}

export function listPremiumViewableYearMonths(
    employee: Employee,
    referenceYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
    latestConfirmedWorkYearMonth: string | null = null,
): string[] {
    const minYm = viewableYearMonthMin(employee);
    const maxYm = premiumViewableYearMonthMax(
        employee,
        referenceYearMonth,
        timing,
        latestConfirmedWorkYearMonth,
    );
    if (!minYm) return [];

    const months: string[] = [];
    let ym = minYm;
    while (ym <= maxYm) {
        if (
            isPremiumViewableYearMonth(
                employee,
                ym,
                referenceYearMonth,
                timing,
                latestConfirmedWorkYearMonth,
            )
        ) {
            months.push(ym);
        }
        ym = addMonthsToYearMonth(ym, 1);
    }
    return months;
}

export function viewableYearMonthReason(
    employee: Employee,
    targetYearMonth: string,
    currentYearMonth: string,
): string | null {
    if (isViewableYearMonth(employee, targetYearMonth, currentYearMonth)) return null;

    return rewardTargetMonthReason(employee, targetYearMonth, currentYearMonth);
}

export function premiumViewableYearMonthReason(
    employee: Employee,
    targetYearMonth: string,
    referenceYearMonth: string,
    timing: InsurancePremiumCollectionTiming,
    latestConfirmedWorkYearMonth: string | null = null,
): string | null {
    if (
        isPremiumViewableYearMonth(
            employee,
            targetYearMonth,
            referenceYearMonth,
            timing,
            latestConfirmedWorkYearMonth,
        )
    ) {
        return null;
    }

    const joinYm = yearMonthFromDateString(employee.joinedDate);
    if (joinYm && targetYearMonth < joinYm) {
        return `${formatYearMonthLabel(joinYm)}入社のため、この月は対象外です。`;
    }

    const maxYm = premiumViewableYearMonthMax(
        employee,
        referenceYearMonth,
        timing,
        latestConfirmedWorkYearMonth,
    );
    if (targetYearMonth > maxYm) {
        return `${formatYearMonthLabel(maxYm)}まで表示できます。`;
    }

    return 'この月は保険料表示の対象外です。';
}

/** 入社月〜現在月の翌月（退職予定月の翌月まで）なら報酬登録対象 */
export function isRewardTargetMonth(
    employee: Employee,
    targetYearMonth: string,
    referenceYearMonth: string = currentYearMonth(),
): boolean {
    if (!YEAR_MONTH_PATTERN.test(targetYearMonth)) return false;

    const joinYm = yearMonthFromDateString(employee.joinedDate);
    if (joinYm && targetYearMonth < joinYm) return false;

    const retireMax = rewardInputMaxWorkYearMonthFromRetirement(employee.retiredDate);
    if (retireMax && targetYearMonth > retireMax) return false;

    if (targetYearMonth > inputableYearMonthMax(employee, referenceYearMonth)) return false;

    return true;
}

export function rewardTargetMonthReason(
    employee: Employee,
    targetYearMonth: string,
    referenceYearMonth: string = currentYearMonth(),
): string | null {
    if (isRewardTargetMonth(employee, targetYearMonth, referenceYearMonth)) return null;

    const joinYm = yearMonthFromDateString(employee.joinedDate);
    if (joinYm && targetYearMonth < joinYm) {
        return `${formatYearMonthLabel(joinYm)}入社のため、この月は対象外です。`;
    }

    const retireMax = rewardInputMaxWorkYearMonthFromRetirement(employee.retiredDate);
    if (retireMax && targetYearMonth > retireMax) {
        return `${formatYearMonthLabel(retireMax)}まで入力できます（退職月の翌月まで）。`;
    }

    const maxYm = inputableYearMonthMax(employee, referenceYearMonth);
    if (targetYearMonth > maxYm) {
        return `${formatYearMonthLabel(maxYm)}まで入力できます。`;
    }

    return 'この月は報酬登録の対象外です。';
}

function formatYearMonthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    return `${y}年${Number(m)}月`;
}

function formatDateLabel(date: string): string {
    const [y, m, d] = date.split('-');
    return `${y}年${Number(m)}月${Number(d)}日`;
}

/** YYYY-MM に月数を加算（日は1日固定） */
export function addMonthsToYearMonth(ym: string, delta: number): string {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
