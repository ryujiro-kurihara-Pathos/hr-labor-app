import { EmploymentType } from '../../employee/models/employee.models';
import { SalaryConditionFormValue, SalaryConditionInput } from '../models/salary-condition.model';
import { StandardMonthlyRewardInput } from '../models/standard-monthly-reward.model';
import { fixedWageTotalFromForm, resolveSalaryConditionEffectiveStartMonth } from './salary-condition.util';
import { yearMonthFromDateString } from './reward-target-month.util';
import { PayrollPaymentMonthOffset } from './standard-remuneration-determination.util';

export function buildPartTimeSalaryConditionFormValue(form: {
    prescribedWage: number | '';
    commutingAllowance: number | '';
    otherFixedAllowance: number | '';
}): SalaryConditionFormValue {
    return {
        effectiveStartMonth: '',
        basicSalary: form.prescribedWage === '' ? '' : form.prescribedWage,
        commutingAllowance: toNumber(form.commutingAllowance),
        positionAllowance: 0,
        housingAllowance: 0,
        fixedOvertimePay: 0,
        otherFixedAllowance: toNumber(form.otherFixedAllowance),
        note: '',
        changeReason: '初回登録',
    };
}

export function partTimeExpectedSalaryTotal(form: {
    prescribedWage: number | '';
    commutingAllowance: number | '';
    otherFixedAllowance: number | '';
}): number {
    return (
        toNumber(form.prescribedWage)
        + toNumber(form.commutingAllowance)
        + toNumber(form.otherFixedAllowance)
    );
}

export function isPartTimeSalaryFormValid(form: {
    prescribedWage: number | '';
    commutingAllowance: number | '';
    otherFixedAllowance: number | '';
}): boolean {
    if (form.prescribedWage === '') return false;
    return partTimeExpectedSalaryTotal(form) > 0;
}

export function buildInitialSalaryConditionInput(params: {
    companyId: string;
    employeeId: string;
    joinedDate: string;
    form: SalaryConditionFormValue;
    payrollPaymentMonthOffset?: PayrollPaymentMonthOffset;
}): SalaryConditionInput | null {
    const effectiveStartMonth = resolveSalaryConditionEffectiveStartMonth(
        params.joinedDate,
        params.payrollPaymentMonthOffset ?? 1,
    );
    if (!effectiveStartMonth) return null;

    return {
        companyId: params.companyId,
        employeeId: params.employeeId,
        effectiveStartMonth,
        basicSalary: toNumber(params.form.basicSalary),
        commutingAllowance: toNumber(params.form.commutingAllowance),
        positionAllowance: toNumber(params.form.positionAllowance),
        housingAllowance: toNumber(params.form.housingAllowance),
        fixedOvertimePay: toNumber(params.form.fixedOvertimePay),
        otherFixedAllowance: toNumber(params.form.otherFixedAllowance),
        note: params.form.note.trim(),
        changeReason: params.form.changeReason.trim(),
    };
}

export function buildJoinMonthRewardFromSalaryCondition(params: {
    companyId: string;
    employeeId: string;
    joinedDate: string;
    employmentType: EmploymentType;
    condition: SalaryConditionInput;
}): StandardMonthlyRewardInput | null {
    const targetYearMonth = yearMonthFromDateString(params.joinedDate);
    if (!targetYearMonth) return null;

    const fixed = {
        basicSalary: params.condition.basicSalary,
        commutingAllowance: params.condition.commutingAllowance,
        positionAllowance: params.condition.positionAllowance,
        housingAllowance: params.condition.housingAllowance,
        fixedOvertimePay: params.condition.fixedOvertimePay,
        otherFixedAllowance: params.condition.otherFixedAllowance,
    };

    const monthlyRewardAmount = params.employmentType === 'part-time'
        ? fixed.basicSalary + fixed.commutingAllowance + fixed.otherFixedAllowance
        : undefined;

    return {
        companyId: params.companyId,
        employeeId: params.employeeId,
        targetYearMonth,
        ...fixed,
        overtimePay: 0,
        holidayPay: 0,
        nightPay: 0,
        commissionPay: 0,
        otherVariablePay: 0,
        healthInsuranceGrade: 0,
        healthInsuranceStandardMonthlyAmount: 0,
        pensionInsuranceGrade: 0,
        pensionInsuranceStandardMonthlyAmount: 0,
        ...(monthlyRewardAmount !== undefined ? { monthlyRewardAmount } : {}),
    };
}

export function buildJoinMonthExpectedRewardInput(params: {
    companyId: string;
    employeeId: string;
    joinedDate: string;
    employmentType: EmploymentType;
    expectedMonthlySalary: number;
}): StandardMonthlyRewardInput | null {
    const targetYearMonth = yearMonthFromDateString(params.joinedDate);
    if (!targetYearMonth || params.expectedMonthlySalary <= 0) return null;

    return buildJoinMonthRewardFromSalaryCondition({
        companyId: params.companyId,
        employeeId: params.employeeId,
        joinedDate: params.joinedDate,
        employmentType: params.employmentType,
        condition: {
            companyId: params.companyId,
            employeeId: params.employeeId,
            effectiveStartMonth: targetYearMonth,
            basicSalary: params.expectedMonthlySalary,
            commutingAllowance: 0,
            positionAllowance: 0,
            housingAllowance: 0,
            fixedOvertimePay: 0,
            otherFixedAllowance: 0,
            note: '',
            changeReason: '',
        },
    });
}

function toNumber(value: number | ''): number {
    if (value === '') return 0;
    return Number.isFinite(value) ? value : 0;
}

export function isSalaryConditionFormValid(form: SalaryConditionFormValue): boolean {
    if (form.basicSalary === '') return false;
    return fixedWageTotalFromForm(form) > 0;
}

