import { Company } from '../../company/models/company.model';
import { Employee } from '../../employee/models/employee.models';
import { resolvePayrollDateInYearMonth } from '../../company/utils/company-payroll-settings.util';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { isRewardConfirmed } from './reward-status.util';
import {
    addMonthsToYearMonth,
    currentYearMonth,
    inputableYearMonthMax,
    isRewardTargetMonth,
    yearMonthFromDateString,
    yearMonthFromTimestamp,
} from './reward-target-month.util';
import {
    formatYearMonthLabel,
    PayrollPaymentMonthOffset,
} from './standard-remuneration-determination.util';

/** 報酬レコードの targetYearMonth に使う支給年月 */
export function rewardRecordKeyForPayMonth(payYearMonth: string): string {
    return payYearMonth;
}

/** Firestore 取得用キー（支給年月 → 旧勤務月キー） */
export function rewardLookupKeysForPayMonth(
    payYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): string[] {
    const keys = [payYearMonth];
    if (payrollPaymentMonthOffset === 1) {
        keys.push(addMonthsToYearMonth(payYearMonth, -1));
    }
    return keys;
}

/** 支給年月で報酬を取得（旧データの勤務月キーにもフォールバック） */
export function lookupRewardByPayMonth(
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    payYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): StandardMonthlyReward | null {
    for (const key of rewardLookupKeysForPayMonth(payYearMonth, payrollPaymentMonthOffset)) {
        const reward = rewardsByYearMonth[key];
        if (reward) return reward;
    }
    return null;
}

/** 支給年月の報酬が確定済みか */
export function isRewardConfirmedForPayMonth(
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    payYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): boolean {
    const reward = lookupRewardByPayMonth(rewardsByYearMonth, payYearMonth, payrollPaymentMonthOffset);
    return isRewardConfirmed(reward);
}

/** 確定済み報酬のうち、最も新しい支給年月 */
export function findLatestConfirmedPayYearMonth(
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): string | null {
    const candidateKeys = new Set<string>();
    for (const ym of Object.keys(rewardsByYearMonth)) {
        candidateKeys.add(ym);
        if (payrollPaymentMonthOffset === 1) {
            candidateKeys.add(addMonthsToYearMonth(ym, 1));
        }
    }

    let latest: string | null = null;
    for (const payYearMonth of candidateKeys) {
        if (!isRewardConfirmedForPayMonth(rewardsByYearMonth, payYearMonth, payrollPaymentMonthOffset)) {
            continue;
        }
        if (!latest || payYearMonth > latest) {
            latest = payYearMonth;
        }
    }
    return latest;
}

/** @deprecated 支給年月ベースへ移行。在籍判定など内部換算用 */
export function resolveWorkMonthFromPayMonth(
    payYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): string {
    if (payrollPaymentMonthOffset === 0) {
        return payYearMonth;
    }
    return addMonthsToYearMonth(payYearMonth, -1);
}

/** 対象勤務月 → 支給年月 */
export function resolvePayMonthFromWorkMonth(
    workYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): string {
    if (payrollPaymentMonthOffset === 0) {
        return workYearMonth;
    }
    return addMonthsToYearMonth(workYearMonth, 1);
}

/** 月ナビの最小支給年月（入社月を含む） */
export function rewardNavigationMinPayYearMonth(
    employee: Employee,
): string | null {
    return yearMonthFromDateString(employee.joinedDate);
}

/** 入社月の支給年月表示か */
export function isJoinPayMonthView(
    employee: Employee,
    payYearMonth: string,
): boolean {
    const joinYm = yearMonthFromDateString(employee.joinedDate);
    return Boolean(joinYm && payYearMonth === joinYm);
}

/** 入社月表示時の説明（翌月払いで給与支給がない場合） */
export function joinPayMonthDisplayNote(
    employee: Employee,
    payYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): string | null {
    if (!isJoinPayMonthView(employee, payYearMonth)) return null;
    if (payrollPaymentMonthOffset !== 1) return null;
    if (isSalaryPayMonthTarget(employee, payYearMonth, payrollPaymentMonthOffset)) return null;

    const joinYm = yearMonthFromDateString(employee.joinedDate)!;
    const nextPayLabel = formatYearMonthLabel(addMonthsToYearMonth(joinYm, 1));
    return `翌月払いのため、入社月（${formatYearMonthLabel(joinYm)}）の給与支給はありません。資格取得届用の報酬は見込み給与または賞与で登録できます。給与の入力は${nextPayLabel}支給分から行ってください。`;
}

export function clampRewardNavigationPayYearMonth(
    employee: Employee,
    payYearMonth: string,
    referenceYearMonth: string = currentYearMonth(),
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): string {
    const minYm = rewardNavigationMinPayYearMonth(employee);
    const maxYm = salaryPayYearMonthMax(employee, referenceYearMonth, payrollPaymentMonthOffset);
    let ym = payYearMonth;
    if (minYm && ym < minYm) ym = minYm;
    if (ym > maxYm) ym = maxYm;
    return ym;
}

/** 給与入力の最小支給年月（翌月払いは入社月の翌月から） */
export function salaryPayYearMonthMin(
    employee: Employee,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): string | null {
    const joinYm = yearMonthFromDateString(employee.joinedDate);
    if (!joinYm) return null;
    if (payrollPaymentMonthOffset === 1) {
        return addMonthsToYearMonth(joinYm, 1);
    }
    return joinYm;
}

/** 給与入力の最大支給年月（対象勤務月の上限から換算） */
export function salaryPayYearMonthMax(
    employee: Employee,
    referenceYearMonth: string = currentYearMonth(),
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): string {
    const workMax = inputableYearMonthMax(employee, referenceYearMonth);
    return resolvePayMonthFromWorkMonth(workMax, payrollPaymentMonthOffset);
}

/** 支給年月が給与入力対象か（翌月払いの入社月は除外） */
export function isSalaryPayMonthTarget(
    employee: Employee,
    payYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
    referenceYearMonth: string = currentYearMonth(),
): boolean {
    const workYearMonth = resolveWorkMonthFromPayMonth(payYearMonth, payrollPaymentMonthOffset);
    if (!isRewardTargetMonth(employee, workYearMonth, referenceYearMonth)) {
        return false;
    }

    if (payrollPaymentMonthOffset === 1) {
        const joinYm = yearMonthFromDateString(employee.joinedDate);
        if (joinYm && payYearMonth === joinYm) {
            return false;
        }
    }

    return true;
}

export function salaryPayMonthTargetReason(
    employee: Employee,
    payYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
    referenceYearMonth: string = currentYearMonth(),
): string | null {
    if (isSalaryPayMonthTarget(employee, payYearMonth, payrollPaymentMonthOffset, referenceYearMonth)) {
        return null;
    }

    const joinYm = yearMonthFromDateString(employee.joinedDate);
    if (payrollPaymentMonthOffset === 1 && joinYm && payYearMonth === joinYm) {
        return `${formatYearMonthLabel(joinYm)}入社のため、この月の給与支給はなく入力対象外です。${formatYearMonthLabel(addMonthsToYearMonth(joinYm, 1))}支給分から入力してください。`;
    }

    const workYearMonth = resolveWorkMonthFromPayMonth(payYearMonth, payrollPaymentMonthOffset);
    const retireYm = yearMonthFromTimestamp(employee.retiredDate);
    if (retireYm && workYearMonth > retireYm) {
        return `${formatYearMonthLabel(retireYm)}退職のため、この月は対象外です。`;
    }

    if (joinYm && workYearMonth < joinYm) {
        return `${formatYearMonthLabel(joinYm)}入社前のため、この月は対象外です。`;
    }

    const maxPayYm = salaryPayYearMonthMax(employee, referenceYearMonth, payrollPaymentMonthOffset);
    if (payYearMonth > maxPayYm) {
        return `${formatYearMonthLabel(maxPayYm)}支給分まで入力できます。`;
    }

    return 'この月は給与入力の対象外です。';
}

export function clampSalaryPayYearMonth(
    employee: Employee,
    payYearMonth: string,
    referenceYearMonth: string = currentYearMonth(),
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): string {
    const minYm = salaryPayYearMonthMin(employee, payrollPaymentMonthOffset);
    const maxYm = salaryPayYearMonthMax(employee, referenceYearMonth, payrollPaymentMonthOffset);
    let ym = payYearMonth;
    if (minYm && ym < minYm) ym = minYm;
    if (ym > maxYm) ym = maxYm;
    return ym;
}

/** 会社設定に基づく支給日（YYYY-MM-DD）。未設定時は null */
export function resolvePayrollPaymentDate(
    company: Pick<Company, 'payrollPaymentDay'> | null | undefined,
    payYearMonth: string,
): string | null {
    const day = company?.payrollPaymentDay;
    if (day === null || day === undefined) return null;
    return resolvePayrollDateInYearMonth(day, payYearMonth);
}

/** 報酬レコードキー（支給年月）のラベル */
export function formatPayYearMonthLabelFromWorkMonth(
    payYearMonth: string,
    _payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): string {
    return formatYearMonthLabel(payYearMonth);
}

/** 報酬レコードキー列のラベル（表示用） */
export function formatPayMonthListFromWorkMonths(
    payYearMonths: string[],
    _payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): string {
    return payYearMonths.map((ym) => formatYearMonthLabel(ym)).join('・');
}

/** 報酬レコードキー範囲のラベル（表示用） */
export function formatPayMonthRangeFromWorkMonths(
    startPayYearMonth: string,
    endPayYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): string {
    return `${formatPayYearMonthLabelFromWorkMonth(startPayYearMonth, payrollPaymentMonthOffset)}〜${formatPayYearMonthLabelFromWorkMonth(endPayYearMonth, payrollPaymentMonthOffset)}`;
}

/** 報酬入力画面の queryParams 用：勤務月 → 支給年月 */
export function resolvePayMonthQueryFromWorkMonth(
    workYearMonth: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
): string {
    return resolvePayMonthFromWorkMonth(workYearMonth, payrollPaymentMonthOffset);
}

/** 未確定の報酬がある支給年月（表示・ナビ用） */
export function listUnconfirmedSalaryPayYearMonths(
    employee: Employee,
    rewardsByWorkMonth: Record<string, StandardMonthlyReward>,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
    referenceYearMonth: string = currentYearMonth(),
): string[] {
    const minYm = salaryPayYearMonthMin(employee, payrollPaymentMonthOffset);
    const maxYm = salaryPayYearMonthMax(employee, referenceYearMonth, payrollPaymentMonthOffset);
    if (!minYm) return [];

    const result: string[] = [];
    let payYearMonth = minYm;
    while (payYearMonth <= maxYm) {
        if (isSalaryPayMonthTarget(employee, payYearMonth, payrollPaymentMonthOffset, referenceYearMonth)) {
            if (!isRewardConfirmedForPayMonth(rewardsByWorkMonth, payYearMonth, payrollPaymentMonthOffset)) {
                result.push(payYearMonth);
            }
        }
        payYearMonth = addMonthsToYearMonth(payYearMonth, 1);
    }
    return result;
}
