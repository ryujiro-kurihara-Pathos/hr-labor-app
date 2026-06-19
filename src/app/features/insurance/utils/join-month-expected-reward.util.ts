import { EmploymentType } from '../../employee/models/employee.models';
import { StandardMonthlyRewardInput } from '../models/standard-monthly-reward.model';
import { yearMonthFromDateString } from './reward-target-month.util';

export function buildJoinMonthExpectedRewardInput(params: {
    companyId: string;
    employeeId: string;
    joinedDate: string;
    employmentType: EmploymentType;
    expectedMonthlySalary: number;
}): StandardMonthlyRewardInput | null {
    const targetYearMonth = yearMonthFromDateString(params.joinedDate);
    if (!targetYearMonth || params.expectedMonthlySalary <= 0) return null;

    return {
        companyId: params.companyId,
        employeeId: params.employeeId,
        targetYearMonth,
        basicSalary: params.expectedMonthlySalary,
        commutingAllowance: 0,
        positionAllowance: 0,
        housingAllowance: 0,
        fixedOvertimePay: 0,
        otherFixedAllowance: 0,
        overtimePay: 0,
        holidayPay: 0,
        nightPay: 0,
        commissionPay: 0,
        otherVariablePay: 0,
        healthInsuranceGrade: 0,
        healthInsuranceStandardMonthlyAmount: 0,
        pensionInsuranceGrade: 0,
        pensionInsuranceStandardMonthlyAmount: 0,
        ...(params.employmentType === 'part-time'
            ? { monthlyRewardAmount: params.expectedMonthlySalary }
            : {}),
    };
}
