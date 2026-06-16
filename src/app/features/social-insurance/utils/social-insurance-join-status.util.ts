import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { insuranceJoinStatus, SocialInsuranceStatus } from '../models/social-insurance-status.model';
import {
    judgeHealthInsuranceJoinStatus,
    judgePensionInsuranceJoinStatus,
} from './age-premium-period.util';
import {
    isPartTimeEmployment,
    PartTimeInsuranceJudgmentInput,
    partTimeJudgmentInputFromStatus,
} from './part-time-insurance-judgment.util';

export type SocialInsuranceJoinJudgmentContext = {
    employmentType: Employee['employmentType'];
    birthDate: string | null | undefined;
    partTimeInput: PartTimeInsuranceJudgmentInput;
    officeRegularWeeklyHours: number | null;
    officeRegularMonthlyWorkDays: number | null;
    isStudent: boolean;
    expectedEmploymentOver2Months: boolean;
};

export function buildSocialInsuranceJoinJudgmentContext(
    employee: Employee | null | undefined,
    status: SocialInsuranceStatus | null | undefined,
    office: Office | null | undefined,
): SocialInsuranceJoinJudgmentContext | null {
    if (!employee) return null;

    return {
        employmentType: employee.employmentType,
        birthDate: employee.birthDate,
        partTimeInput: partTimeJudgmentInputFromStatus(status),
        officeRegularWeeklyHours: office?.regularWeeklyScheduledWorkHours ?? null,
        officeRegularMonthlyWorkDays: office?.regularMonthlyScheduledWorkDays ?? null,
        isStudent: status?.isStudent ?? false,
        expectedEmploymentOver2Months: status?.expectedEmploymentOver2Months ?? false,
    };
}

function meetsThreeQuartersRule(
    ctx: SocialInsuranceJoinJudgmentContext,
    employeeWeeklyHours: number,
    employeeMonthlyDays: number,
): boolean {
    const regularWeekly = ctx.officeRegularWeeklyHours;
    const regularMonthlyDays = ctx.officeRegularMonthlyWorkDays;
    if (
        regularWeekly === null ||
        regularWeekly <= 0 ||
        regularMonthlyDays === null ||
        regularMonthlyDays <= 0
    ) {
        return false;
    }

    return (
        employeeWeeklyHours >= regularWeekly * 0.75 &&
        employeeMonthlyDays >= regularMonthlyDays * 0.75
    );
}

function meetsShortTimeWorkerConditions(
    ctx: SocialInsuranceJoinJudgmentContext,
    employeeWeeklyHours: number,
    employeeMonthlyDays: number,
    wage: number,
): boolean {
    return (
        employeeWeeklyHours >= 20 &&
        employeeMonthlyDays >= 11 &&
        wage >= 88000 &&
        ctx.expectedEmploymentOver2Months &&
        !ctx.isStudent
    );
}

/** 雇用形態・労働時間に基づく社会保険の加入要件（年齢は含まない） */
export function judgeSocialInsuranceEmploymentStatus(
    ctx: SocialInsuranceJoinJudgmentContext,
): insuranceJoinStatus {
    if (!ctx.employmentType) return 'unknown';
    if (!isPartTimeEmployment(ctx.employmentType)) return 'active';

    const weeklyHours = ctx.partTimeInput.weeklyScheduledWorkHours;
    const monthlyDays = ctx.partTimeInput.monthlyScheduledWorkDays;
    const wage = ctx.partTimeInput.prescribedWage;
    if (weeklyHours === null || monthlyDays === null || wage === null) return 'unknown';
    if (weeklyHours <= 0 || monthlyDays <= 0 || wage < 0) return 'unknown';

    if (meetsThreeQuartersRule(ctx, weeklyHours, monthlyDays)) return 'active';
    if (meetsShortTimeWorkerConditions(ctx, weeklyHours, monthlyDays, wage)) return 'active';
    return 'inactive';
}

export function resolveHealthInsuranceJoinStatus(
    stored: insuranceJoinStatus | null | undefined,
    ctx: SocialInsuranceJoinJudgmentContext | null,
): insuranceJoinStatus {
    if (stored === 'active' || stored === 'inactive') return stored;
    if (!ctx) return stored ?? 'unknown';
    return judgeHealthInsuranceJoinStatus(judgeSocialInsuranceEmploymentStatus(ctx), ctx.birthDate);
}

export function resolvePensionInsuranceJoinStatus(
    stored: insuranceJoinStatus | null | undefined,
    ctx: SocialInsuranceJoinJudgmentContext | null,
): insuranceJoinStatus {
    if (stored === 'active' || stored === 'inactive') return stored;
    if (!ctx) return stored ?? 'unknown';
    return judgePensionInsuranceJoinStatus(judgeSocialInsuranceEmploymentStatus(ctx), ctx.birthDate);
}
