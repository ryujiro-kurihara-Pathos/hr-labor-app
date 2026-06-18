import { Timestamp } from 'firebase/firestore';

import { Dependent, Employee } from '../../employee/models/employee.models';
import { getQualificationDate } from '../../insurance/utils/standard-remuneration-determination.util';
import { dateStringFromTimestamp } from '../../insurance/utils/reward-target-month.util';
import { lossDateFromRetirementDate } from './insurance-premium-period.util';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type InsuredPeriodBounds = {
    qualificationDate: string | null;
    lossDate: string | null;
};

function formatDateLabel(date: string): string {
    const [y, m, d] = date.split('-');
    return `${y}年${Number(m)}月${Number(d)}日`;
}

export function isValidDateString(date: string): boolean {
    return DATE_PATTERN.test(date.trim());
}

export function resolveRetiredDateString(employee: Employee): string | null {
    return dateStringFromTimestamp(employee.retiredDate);
}

/** 被保険者の資格取得日・資格喪失日の範囲 */
export function resolveInsuredPeriodBounds(params: {
    employee: Employee;
    healthInsuranceStartDate?: string | null;
    healthInsuranceEndDate?: string | null;
}): InsuredPeriodBounds {
    const qualificationDate = getQualificationDate(
        params.employee,
        params.healthInsuranceStartDate,
    );
    const registeredLoss = params.healthInsuranceEndDate?.trim() || null;
    const retiredDate = resolveRetiredDateString(params.employee);
    const lossDate = registeredLoss || (retiredDate ? lossDateFromRetirementDate(retiredDate) : null);

    return { qualificationDate, lossDate };
}

/** 資格取得日: 入社日以降、退職日以前 */
export function validateQualificationDateRange(
    qualificationDate: string,
    employee: Employee,
): string | null {
    if (!isValidDateString(qualificationDate)) {
        return '資格取得日の形式が正しくありません。';
    }

    const joinedDate = employee.joinedDate?.trim();
    if (joinedDate && qualificationDate < joinedDate) {
        return `資格取得日は入社日（${formatDateLabel(joinedDate)}）以降の日付を指定してください。`;
    }

    const retiredDate = resolveRetiredDateString(employee);
    if (retiredDate && qualificationDate > retiredDate) {
        return `資格取得日は退職日（${formatDateLabel(retiredDate)}）以前の日付を指定してください。`;
    }

    return null;
}

/** 資格喪失日: 資格取得日より後 */
export function validateLossDateRange(
    lossDate: string,
    qualificationDate: string | null,
): string | null {
    if (!isValidDateString(lossDate)) {
        return '資格喪失日の形式が正しくありません。';
    }

    const qualification = qualificationDate?.trim();
    if (qualification && lossDate <= qualification) {
        return `資格喪失日は資格取得日（${formatDateLabel(qualification)}）より後の日付を指定してください。`;
    }

    return null;
}

/** 資格取得日以降、資格喪失日より前（賞与支給日・被扶養者異動日など） */
export function validateDateWithinInsuredPeriod(
    date: string,
    bounds: InsuredPeriodBounds,
): string | null {
    if (!isValidDateString(date)) {
        return '日付の形式が正しくありません。';
    }

    const qualification = bounds.qualificationDate?.trim();
    if (qualification && date < qualification) {
        return `資格取得日（${formatDateLabel(qualification)}）以降の日付を指定してください。`;
    }

    const loss = bounds.lossDate?.trim();
    if (loss && date >= loss) {
        return `資格喪失日（${formatDateLabel(loss)}）より前の日付を指定してください。`;
    }

    return null;
}

/** 被扶養者異動日の追加チェック（削除・変更は扶養期間内） */
export function validateDependentOccurredDate(params: {
    occurredDate: string;
    changeType: 'add' | 'change' | 'delete';
    bounds: InsuredPeriodBounds;
    dependencyStartDate?: string | null;
    dependencyEndDate?: string | null;
}): string | null {
    const insuredReason = validateDateWithinInsuredPeriod(params.occurredDate, params.bounds);
    if (insuredReason) return insuredReason;

    if (params.changeType === 'add') {
        return null;
    }

    const start = params.dependencyStartDate?.trim();
    if (start && params.occurredDate < start) {
        return `異動日は被扶養者になった日（${formatDateLabel(start)}）以降の日付を指定してください。`;
    }

    const end = params.dependencyEndDate?.trim();
    if (end && params.occurredDate > end) {
        return `異動日は被扶養者でなくなった日（${formatDateLabel(end)}）以前の日付を指定してください。`;
    }

    return null;
}

export function resolveDependentOccurredDateBounds(params: {
    changeType: 'add' | 'change' | 'delete' | null;
    bounds: InsuredPeriodBounds;
    dependent?: Dependent | null;
}): { min: string | null; max: string | null } {
    const qualification = params.bounds.qualificationDate?.trim() || null;
    const loss = params.bounds.lossDate?.trim() || null;
    let max = loss ? subtractOneDay(loss) : null;

    if (params.changeType === 'change' || params.changeType === 'delete') {
        const end = params.dependent?.dependencyEndDate?.trim();
        if (end && (!max || end < max)) {
            max = end;
        }
    }

    let min = qualification;
    if (params.changeType === 'change' || params.changeType === 'delete') {
        const start = params.dependent?.dependencyStartDate?.trim();
        if (start && (!min || start > min)) {
            min = start;
        }
    }

    return { min, max };
}

export function resolveBonusPaymentDateBounds(params: {
    employee: Employee;
    targetYearMonth: string;
    healthInsuranceStartDate?: string | null;
    healthInsuranceEndDate?: string | null;
    monthEndDate?: string | null;
}): { min: string | null; max: string | null } {
    const bounds = resolveInsuredPeriodBounds({
        employee: params.employee,
        healthInsuranceStartDate: params.healthInsuranceStartDate,
        healthInsuranceEndDate: params.healthInsuranceEndDate,
    });

    const qualification = bounds.qualificationDate?.trim() || null;
    const monthStart = `${params.targetYearMonth}-01`;
    let min = qualification;
    if (qualification?.startsWith(params.targetYearMonth)) {
        min = qualification;
    } else if (qualification && qualification > monthStart) {
        min = qualification;
    } else {
        min = monthStart;
    }

    let max = bounds.lossDate ? subtractOneDay(bounds.lossDate) : params.monthEndDate ?? null;
    if (params.monthEndDate && max && params.monthEndDate < max) {
        max = params.monthEndDate;
    }

    const retiredDate = resolveRetiredDateString(params.employee);
    if (retiredDate?.startsWith(params.targetYearMonth) && (!max || retiredDate < max)) {
        max = retiredDate;
    }

    return { min, max };
}

function subtractOneDay(date: string): string | null {
    if (!isValidDateString(date)) return null;
    const [y, m, d] = date.split('-').map(Number);
    const next = new Date(y, m - 1, d);
    if (Number.isNaN(next.getTime())) return null;
    next.setDate(next.getDate() - 1);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, '0');
    const day = String(next.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function retiredDateStringFromTimestamp(retiredDate: Timestamp | null | undefined): string | null {
    return dateStringFromTimestamp(retiredDate);
}
