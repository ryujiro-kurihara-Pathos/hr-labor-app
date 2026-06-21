import { Employee } from '../../employee/models/employee.models';
import { SalaryCondition } from '../models/salary-condition.model';
import { StandardMonthlyReward, StandardMonthlyRewardInput } from '../models/standard-monthly-reward.model';
import {
    applySalaryConditionToRewardDraft,
    fixedWageFieldsFromSalaryCondition,
    isConfirmedRewardStatus,
    resolveSalaryConditionForMonth,
} from './salary-condition.util';
import { addMonthsToYearMonth, isRewardTargetMonth } from './reward-target-month.util';
import { normalizeRewardStatus } from './reward-status.util';

export function buildSalaryConditionRewardDraftInput(params: {
    employee: Employee;
    targetYearMonth: string;
    condition: SalaryCondition;
    existing: StandardMonthlyReward | null;
    triggersRevision: boolean;
}): StandardMonthlyRewardInput {
    const fixed = fixedWageFieldsFromSalaryCondition(params.condition);
    const isOriginMonth = params.targetYearMonth === params.condition.effectiveStartMonth;

    return {
        companyId: params.employee.companyId,
        employeeId: params.employee.id,
        targetYearMonth: params.targetYearMonth,
        ...fixed,
        overtimePay: params.existing?.overtimePay ?? 0,
        holidayPay: params.existing?.holidayPay ?? 0,
        nightPay: params.existing?.nightPay ?? 0,
        commissionPay: params.existing?.commissionPay ?? 0,
        otherVariablePay: params.existing?.otherVariablePay ?? 0,
        fixedWageChanged: isOriginMonth && params.triggersRevision ? true : params.existing?.fixedWageChanged,
        changedFixedWageFields: params.existing?.changedFixedWageFields,
        healthInsuranceGrade: params.existing?.healthInsuranceGrade ?? 0,
        healthInsuranceStandardMonthlyAmount: params.existing?.healthInsuranceStandardMonthlyAmount ?? 0,
        pensionInsuranceGrade: params.existing?.pensionInsuranceGrade ?? 0,
        pensionInsuranceStandardMonthlyAmount: params.existing?.pensionInsuranceStandardMonthlyAmount ?? 0,
    };
}

export function listRewardMonthsToSyncFromSalaryCondition(params: {
    employee: Employee;
    savedCondition: SalaryCondition;
    allConditions: SalaryCondition[];
    rewardsByYearMonth: Record<string, StandardMonthlyReward>;
    maxYearMonth: string;
}): string[] {
    const months: string[] = [];
    let yearMonth = params.savedCondition.effectiveStartMonth;

    while (yearMonth <= params.maxYearMonth) {
        if (!isRewardTargetMonth(params.employee, yearMonth)) break;

        const reward = params.rewardsByYearMonth[yearMonth];
        if (reward && isConfirmedRewardStatus(normalizeRewardStatus(reward))) {
            yearMonth = addMonthsToYearMonth(yearMonth, 1);
            continue;
        }

        const condition = resolveSalaryConditionForMonth(params.allConditions, yearMonth);
        if (!condition) break;

        months.push(yearMonth);
        yearMonth = addMonthsToYearMonth(yearMonth, 1);
    }

    return months;
}

export function applySalaryConditionFixedWagesToFormFields(
    condition: SalaryCondition,
): Record<'basicSalary' | 'commutingAllowance' | 'positionAllowance' | 'housingAllowance' | 'fixedOvertimePay' | 'otherFixedAllowance', number> {
    return fixedWageFieldsFromSalaryCondition(condition);
}

export function previewRewardWithSalaryCondition(
    reward: StandardMonthlyReward | null,
    condition: SalaryCondition,
    targetYearMonth: string,
    companyId: string,
    employeeId: string,
): StandardMonthlyReward {
    return applySalaryConditionToRewardDraft(
        reward,
        condition,
        targetYearMonth,
        companyId,
        employeeId,
        false,
    );
}
