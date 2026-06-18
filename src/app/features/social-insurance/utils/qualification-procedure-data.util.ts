import { Company } from '../../company/models/company.model';
import { Office } from '../../company/models/office.model';
import { formatOfficeAddress } from '../../company/utils/office-format.util';
import { Employee, EmploymentType } from '../../employee/models/employee.models';
import { getQualificationDate } from '../../insurance/utils/standard-remuneration-determination.util';
import { shouldProrateMonthlyRewardByPaymentBaseDays } from '../../insurance/utils/monthly-reward-proration.util';
import { Procedure, ProcedureStatus, QualificationProcedureData } from '../models/procedures.model';
import { insuranceJoinStatus } from '../models/social-insurance-status.model';
import { employeeAddressLabel } from './procedure-display.util';
import { qualificationProcedureDueDate } from './procedure-due-date.util';
import { QualificationMonthlyReward } from './qualification-reward.util';

export { qualificationProcedureDueDate };

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

export function hasJoinDateChanged(
    previousJoinedDate: string | null | undefined,
    newJoinedDate: string | null | undefined,
): boolean {
    const previous = previousJoinedDate?.trim() ?? '';
    const next = newJoinedDate?.trim() ?? '';
    return next !== '' && previous !== next;
}

/** 資格取得日が入社日起点（手入力の取得日ではない）か */
export function isQualificationDateDerivedFromJoinDate(
    healthInsuranceStartDate: string | null | undefined,
    previousJoinedDate: string | null | undefined,
    procedure: Pick<Procedure, 'qualificationDate' | 'occurredDate'> | null,
): boolean {
    if (!healthInsuranceStartDate?.trim()) return true;

    const start = healthInsuranceStartDate.trim();
    const previousJoin = previousJoinedDate?.trim();
    if (previousJoin && start === previousJoin) return true;

    const procedureDate = procedure?.qualificationDate?.trim() || procedure?.occurredDate?.trim();
    if (procedureDate && start === procedureDate) return true;

    return false;
}

export function shouldSyncQualificationProcedureDates(
    procedureStatus: ProcedureStatus,
    healthInsuranceStartDate: string | null | undefined,
    options?: {
        previousJoinedDate?: string | null;
        newJoinedDate?: string | null;
        procedure?: Pick<Procedure, 'qualificationDate' | 'occurredDate' | 'dueDate'> | null;
        employee?: Employee | null;
    },
): boolean {
    if (procedureStatus === 'completed') return false;
    if (hasJoinDateChanged(options?.previousJoinedDate, options?.newJoinedDate)) return true;

    const employee = options?.employee;
    const procedure = options?.procedure;
    if (!employee || !procedure) return false;

    const effectiveStart = resolveEffectiveHealthInsuranceStartDateForSync(
        employee,
        healthInsuranceStartDate ?? null,
        options?.previousJoinedDate ?? null,
        { ...procedure, status: procedureStatus },
    );
    const expected = resolveQualificationProcedureDates(employee, effectiveStart);
    if (!expected) return false;

    const storedQualification = procedure.qualificationDate?.trim() ?? '';
    const expectedQualification = expected.qualificationDate?.trim() ?? '';
    return (
        storedQualification !== expectedQualification
        || procedure.occurredDate !== expected.occurredDate
        || procedure.dueDate !== expected.dueDate
    );
}

/** 手続き未完了時に入社日から資格取得日を表示する */
export function resolvePreviewQualificationDate(
    employee: Employee | null | undefined,
    options?: {
        joinedDate?: string | null;
        healthInsuranceStartDate?: string | null;
        procedure?: Pick<Procedure, 'qualificationDate' | 'occurredDate' | 'status'> | null;
    },
): string | null {
    const procedure = options?.procedure;
    const registered = options?.healthInsuranceStartDate?.trim()
        || procedure?.qualificationDate?.trim()
        || null;

    if (procedure?.status === 'completed') {
        return registered;
    }

    const joinedDate = (options?.joinedDate ?? employee?.joinedDate)?.trim() || null;
    if (joinedDate) {
        return joinedDate;
    }

    return registered;
}

/** 同期時に入社日を資格取得日のソースとして使う */
export function resolveEffectiveHealthInsuranceStartDateForSync(
    employee: Employee,
    healthInsuranceStartDate: string | null | undefined,
    previousJoinedDate: string | null | undefined,
    procedure: Pick<Procedure, 'qualificationDate' | 'occurredDate' | 'status'> | null,
): string | null {
    if (procedure?.status !== 'completed' && hasJoinDateChanged(previousJoinedDate, employee.joinedDate)) {
        return null;
    }

    const procedureDate =
        procedure?.qualificationDate?.trim()
        || procedure?.occurredDate?.trim();
    const previousJoin = previousJoinedDate?.trim();
    const newJoin = employee.joinedDate?.trim();

    if (
        previousJoin
        && newJoin
        && previousJoin !== newJoin
        && procedureDate === previousJoin
    ) {
        return null;
    }

    if (isQualificationDateDerivedFromJoinDate(healthInsuranceStartDate, previousJoinedDate, procedure)) {
        return null;
    }

    return healthInsuranceStartDate?.trim() || null;
}

/** 入社日変更に合わせて社会保険の開始日も更新するか */
export function shouldUpdateInsuranceStartDatesFromJoinDate(
    previousJoinedDate: string | null | undefined,
    newJoinedDate: string,
    _healthInsuranceStartDate: string | null | undefined = null,
    _pensionInsuranceStartDate: string | null | undefined = null,
    procedure: Pick<Procedure, 'status'> | null = null,
): boolean {
    if (procedure?.status === 'completed') return false;
    return hasJoinDateChanged(previousJoinedDate, newJoinedDate);
}

/** 入社日変更後に保存する資格取得日を返す */
export function resolveQualificationDateAfterJoinDateChange(
    employee: Employee,
    previousJoinedDate: string | null | undefined,
    procedure: Pick<Procedure, 'status'> | null,
): string | null {
    if (!shouldUpdateInsuranceStartDatesFromJoinDate(previousJoinedDate, employee.joinedDate, null, null, procedure)) {
        return null;
    }

    return (
        resolveQualificationProcedureDates(employee, null)?.qualificationDate
        ?? employee.joinedDate?.trim()
        ?? null
    );
}

export function resolveLiveQualificationDisplayDate(
    employee: Employee | null,
    healthInsuranceStartDate: string | null | undefined,
    procedure: Pick<Procedure, 'qualificationDate' | 'occurredDate' | 'status'>,
): string | null {
    if (!employee) {
        return (
            healthInsuranceStartDate?.trim()
            || procedure.qualificationDate?.trim()
            || procedure.occurredDate?.trim()
            || null
        );
    }

    if (procedure.status === 'completed') {
        return (
            procedure.qualificationDate?.trim()
            || procedure.occurredDate?.trim()
            || null
        );
    }

    return (
        resolveQualificationProcedureDates(employee, null)?.qualificationDate
        ?? employee.joinedDate?.trim()
        ?? null
    );
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
