import { Employee } from '../../employee/models/employee.models';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import {
    isRewardConfirmedForPayMonth,
    isSalaryPayMonthTarget,
    salaryPayYearMonthMax,
    salaryPayYearMonthMin,
} from './reward-pay-month.util';
import { isRewardConfirmed } from './reward-status.util';
import {
    addMonthsToYearMonth,
    currentYearMonth,
    isRewardTargetMonth,
    listViewableYearMonths,
} from './reward-target-month.util';
import { PayrollPaymentMonthOffset } from './standard-remuneration-determination.util';

/** 従業員ごとに、未確定の報酬がある最も古い対象勤務月 */
export function findEmployeeOldestUnregisteredYearMonth(
    employee: Employee,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    referenceYearMonth: string = currentYearMonth(),
): string | null {
    let oldest: string | null = null;

    for (const yearMonth of listViewableYearMonths(employee, referenceYearMonth)) {
        if (!isRewardTargetMonth(employee, yearMonth, referenceYearMonth)) continue;
        if (isRewardConfirmed(rewardsByYearMonth[yearMonth])) continue;
        if (!oldest || yearMonth < oldest) {
            oldest = yearMonth;
        }
    }

    return oldest;
}

/** 未確定の報酬がある最も古い支給年月 */
export function findEmployeeOldestUnregisteredPayYearMonth(
    employee: Employee,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
    referenceYearMonth: string = currentYearMonth(),
): string | null {
    const minYm = salaryPayYearMonthMin(employee, payrollPaymentMonthOffset);
    const maxYm = salaryPayYearMonthMax(employee, referenceYearMonth, payrollPaymentMonthOffset);
    if (!minYm) return null;

    let oldest: string | null = null;
    let payYearMonth = minYm;
    while (payYearMonth <= maxYm) {
        if (
            isSalaryPayMonthTarget(employee, payYearMonth, payrollPaymentMonthOffset, referenceYearMonth)
            && !isRewardConfirmedForPayMonth(rewardsByYearMonth, payYearMonth, payrollPaymentMonthOffset)
        ) {
            if (!oldest || payYearMonth < oldest) {
                oldest = payYearMonth;
            }
        }
        payYearMonth = addMonthsToYearMonth(payYearMonth, 1);
    }

    return oldest;
}

/** 未確定の報酬がある最も古い対象年月（会社全体） */
export function findOldestUnregisteredYearMonth(
    employees: Employee[],
    rewardsByEmployeeId: Record<string, Record<string, StandardMonthlyReward>>,
    referenceYearMonth: string = currentYearMonth(),
): string | null {
    let oldest: string | null = null;

    for (const employee of employees) {
        const employeeOldest = findEmployeeOldestUnregisteredYearMonth(
            employee,
            rewardsByEmployeeId[employee.id] ?? {},
            referenceYearMonth,
        );
        if (employeeOldest && (!oldest || employeeOldest < oldest)) {
            oldest = employeeOldest;
        }
    }

    return oldest;
}

/** 未確定の報酬がある最も古い支給年月（会社全体） */
export function findOldestUnregisteredPayYearMonth(
    employees: Employee[],
    rewardsByEmployeeId: Record<string, Record<string, StandardMonthlyReward>>,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
    referenceYearMonth: string = currentYearMonth(),
): string | null {
    let oldest: string | null = null;

    for (const employee of employees) {
        const employeeOldest = findEmployeeOldestUnregisteredPayYearMonth(
            employee,
            rewardsByEmployeeId[employee.id] ?? {},
            payrollPaymentMonthOffset,
            referenceYearMonth,
        );
        if (employeeOldest && (!oldest || employeeOldest < oldest)) {
            oldest = employeeOldest;
        }
    }

    return oldest;
}

export function listSalaryPayYearMonths(
    employee: Employee,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset,
    referenceYearMonth: string = currentYearMonth(),
): string[] {
    const minYm = salaryPayYearMonthMin(employee, payrollPaymentMonthOffset);
    const maxYm = salaryPayYearMonthMax(employee, referenceYearMonth, payrollPaymentMonthOffset);
    if (!minYm) return [];

    const months: string[] = [];
    let ym = minYm;
    while (ym <= maxYm) {
        months.push(ym);
        ym = addMonthsToYearMonth(ym, 1);
    }
    return months;
}

export function formatYearMonthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    return `${y}年${Number(m)}月`;
}
