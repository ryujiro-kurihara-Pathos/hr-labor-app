import { Company } from '../../company/models/company.model';
import { Office } from '../../company/models/office.model';
import { formatOfficeAddress } from '../../company/utils/office-format.util';
import { Employee, EmploymentType } from '../../employee/models/employee.models';
import { getQualificationDate } from '../../insurance/utils/standard-remuneration-determination.util';
import { shouldProrateMonthlyRewardByPaymentBaseDays } from '../../insurance/utils/monthly-reward-proration.util';
import { Procedure, ProcedureStatus, QualificationProcedureData } from '../models/procedures.model';
import { insuranceJoinStatus } from '../models/social-insurance-status.model';
import { employeeAddressLabel } from './procedure-display.util';
import { QualificationMonthlyReward } from './qualification-reward.util';

export type QualificationProcedureDates = {
    qualificationDate: string | null;
    occurredDate: string;
    dueDate: string;
};

export function todayDateString(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** YYYY-MM-DD に日数を加算 */
export function addDaysToDateString(dateString: string, days: number): string {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** 資格取得届の対応期限（資格取得日から5日後） */
export function qualificationProcedureDueDate(qualificationDate: string): string {
    return addDaysToDateString(qualificationDate, 5);
}

export function resolveQualificationProcedureDates(
    employee: Employee,
    healthInsuranceStartDate: string | null | undefined,
): QualificationProcedureDates | null {
    const qualificationDate = getQualificationDate(employee, healthInsuranceStartDate);
    const joinedDate = employee.joinedDate?.trim();
    if (!qualificationDate && !joinedDate) return null;

    const occurredDate = qualificationDate ?? joinedDate;
    const dueDate = qualificationDate ? qualificationProcedureDueDate(qualificationDate) : '';

    return { qualificationDate, occurredDate, dueDate };
}

export function canAutoManageQualificationProcedure(
    healthInsuranceStatus: insuranceJoinStatus | undefined,
    pensionInsuranceStatus: insuranceJoinStatus | undefined,
): boolean {
    return healthInsuranceStatus !== 'inactive' && pensionInsuranceStatus !== 'inactive';
}

export function shouldSyncQualificationProcedureDates(
    procedureStatus: ProcedureStatus,
    healthInsuranceStartDate: string | null | undefined,
): boolean {
    return procedureStatus !== 'completed' && !healthInsuranceStartDate?.trim();
}

export function buildQualificationProcedureData(params: {
    employee: Employee;
    office: Office;
    company: Company;
    qualificationDate: string | null;
    monthlyReward: QualificationMonthlyReward | null;
    hasDependents: boolean;
}): QualificationProcedureData {
    const { employee, office, company, qualificationDate, monthlyReward, hasDependents } = params;

    return {
        officeSymbol: office.officeSymbol,
        officeNumber: office.officeNumber,
        companyName: company.name,
        officeName: office.name,
        officeAddress: formatOfficeAddress(office),
        representativeName: company.representativeName,
        phoneNumber: office.phoneNumber,
        employeeLastName: employee.lastName,
        employeeFirstName: employee.firstName,
        employeeLastNameKana: employee.lastNameKana,
        employeeFirstNameKana: employee.firstNameKana,
        birthDate: employee.birthDate,
        myNumber: employee.myNumber,
        insuredPersonNumber: employee.insuredPersonNumber.trim(),
        employeeAddress: employeeAddressLabel(employee),
        qualificationDate: qualificationDate ?? '',
        rewardTargetYearMonth: monthlyReward?.targetYearMonth ?? null,
        rewardCashAmount: monthlyReward?.cashAmount ?? null,
        rewardInKindAmount: monthlyReward?.inKindAmount ?? null,
        rewardTotalAmount: monthlyReward?.totalAmount ?? null,
        rewardIsMidMonthJoin: monthlyReward?.isMidMonthJoin ?? false,
        hasDependents,
    };
}

export function hasSavedQualificationData(procedure: Procedure): boolean {
    return Boolean(
        procedure.employeeLastName.trim() ||
        procedure.companyName.trim() ||
        procedure.qualificationDate.trim(),
    );
}

export function monthlyRewardFromProcedure(
    procedure: Procedure,
    employmentType: EmploymentType = null,
): QualificationMonthlyReward | null {
    if (procedure.rewardTotalAmount === null || procedure.rewardTargetYearMonth === null) {
        return null;
    }

    const usesDirectMonthlyRewardEntry =
        !shouldProrateMonthlyRewardByPaymentBaseDays(employmentType);

    return {
        targetYearMonth: procedure.rewardTargetYearMonth,
        cashAmount: procedure.rewardCashAmount ?? 0,
        inKindAmount: procedure.rewardInKindAmount ?? 0,
        totalAmount: procedure.rewardTotalAmount,
        isMidMonthJoin: !usesDirectMonthlyRewardEntry && procedure.rewardIsMidMonthJoin,
        usesDirectMonthlyRewardEntry,
    };
}
