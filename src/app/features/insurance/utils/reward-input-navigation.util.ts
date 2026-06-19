import { Employee } from '../../employee/models/employee.models';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { isRewardConfirmed } from './reward-status.util';
import {
    currentYearMonth,
    isRewardTargetMonth,
    listViewableYearMonths,
} from './reward-target-month.util';

/** 従業員ごとに、未確定の報酬がある最も古い対象年月 */
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

export function formatYearMonthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    return `${y}年${Number(m)}月`;
}
