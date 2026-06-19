import { Company } from '../../company/models/company.model';
import { Office } from '../../company/models/office.model';
import { Employee } from '../../employee/models/employee.models';
import {
    DependentAddReason,
    DependentDeleteReason,
    LossReason,
    Procedure,
} from '../models/procedures.model';
import { QualificationMonthlyReward } from './qualification-reward.util';
import {
    resolveInsuredPeriodBounds,
    validateDateWithinInsuredPeriod,
    validateDependentOccurredDate,
    validateLossDateRange,
    validateQualificationDateRange,
} from './procedure-date-range.util';
import { getQualificationDate } from '../../insurance/utils/standard-remuneration-determination.util';

export type ProcedureSubmitMissingField = {
    label: string;
    routerLink?: string | string[];
    fragment?: string;
    queryParams?: Record<string, string>;
};

export type ProcedureSubmitValidationResult =
    | { ok: true }
    | { ok: false; message: string; missingFields?: ProcedureSubmitMissingField[] };

export const PROCEDURE_SUBMIT_MISSING_FIELDS_MESSAGE = '未入力の項目があります';

export type DependentProcedureSubmitForm = {
    changeDate: string;
    dependentId: string;
    lastName: string;
    firstName: string;
    birthDate: string;
    gender: string;
    relationship: string;
    dependencyStartDate: string;
    addReason: DependentAddReason | '';
    addReasonNote: string;
    dependencyEndDate: string;
    deleteReason: DependentDeleteReason | '';
};

const INVALID_REVISION_REASONS = new Set([
    '固定的賃金の変更なし',
    '算定に必要な報酬が未入力',
    '改定前の標準報酬月額が取得できません',
    '改定後の等級を判定できません',
    '等級差が2未満のため随時改定の対象外',
]);

function errorFailure(message: string): ProcedureSubmitValidationResult {
    return { ok: false, message };
}

function missingFieldsFailure(fields: ProcedureSubmitMissingField[]): ProcedureSubmitValidationResult {
    return {
        ok: false,
        message: PROCEDURE_SUBMIT_MISSING_FIELDS_MESSAGE,
        missingFields: fields,
    };
}

function employeeLink(
    employeeId: string,
    label: string,
    fragment?: string,
): ProcedureSubmitMissingField {
    return { label, routerLink: ['/employees', employeeId], fragment };
}

function premiumLink(
    employeeId: string,
    yearMonth: string,
    label: string,
): ProcedureSubmitMissingField {
    return {
        label,
        routerLink: ['/rewards', employeeId],
        queryParams: { ym: yearMonth },
    };
}

function procedureFormLink(
    procedureId: string | undefined,
    label: string,
    fragment: string,
): ProcedureSubmitMissingField {
    if (!procedureId) {
        return { label, fragment };
    }
    return { label, routerLink: ['/procedures', procedureId], fragment };
}

function collectMissingFields(labels: Record<string, boolean>): string[] {
    return Object.entries(labels)
        .filter(([, present]) => !present)
        .map(([label]) => label);
}

function validateOfficeFields(office: Office | null | undefined): ProcedureSubmitMissingField[] {
    if (!office) return [{ label: '事業所情報', routerLink: '/company' }];

    const officeLink: string[] = ['/company/offices', office.id];
    return collectMissingFields({
        事業所整理記号: Boolean(office.officeSymbol?.trim()),
        事業所番号: Boolean(office.officeNumber?.trim()),
        事業所名称: Boolean(office.name?.trim()),
        都道府県: Boolean(office.prefecture?.trim()),
    }).map((label) => ({ label, routerLink: officeLink }));
}

function validateCompanyFields(company: Company | null | undefined): ProcedureSubmitMissingField[] {
    if (!company) return [{ label: '会社情報', routerLink: '/company' }];

    return collectMissingFields({
        会社名: Boolean(company.name?.trim()),
        事業主氏名: Boolean(company.representativeName?.trim()),
    }).map((label) => ({ label, routerLink: '/company' }));
}

function validateEmployeeFields(employee: Employee | null | undefined): ProcedureSubmitMissingField[] {
    if (!employee) return [{ label: '被保険者情報', routerLink: '/employees' }];

    const fields: ProcedureSubmitMissingField[] = [];
    const missing = collectMissingFields({
        氏名: Boolean(employee.lastName?.trim() && employee.firstName?.trim()),
        '氏名（カナ）': Boolean(employee.lastNameKana?.trim() && employee.firstNameKana?.trim()),
        生年月日: Boolean(employee.birthDate?.trim()),
        性別: Boolean(employee.gender),
        '住所（都道府県）': Boolean(employee.prefecture?.trim()),
        '住所（市区町村）': Boolean(employee.city?.trim()),
        '住所（町名・番地）': Boolean(employee.streetAddress?.trim()),
    });

    for (const label of missing) {
        fields.push(employeeLink(employee.id, label));
    }
    return fields;
}

function validateCommonProcedureContext(params: {
    employee: Employee | null | undefined;
    office: Office | null | undefined;
    company: Company | null | undefined;
}): ProcedureSubmitValidationResult | null {
    const missing = [
        ...validateCompanyFields(params.company),
        ...validateOfficeFields(params.office),
        ...validateEmployeeFields(params.employee),
    ];
    if (missing.length === 0) return null;
    return missingFieldsFailure(missing);
}

function joinYearMonth(joinedDate: string | null | undefined): string | null {
    const trimmed = joinedDate?.trim();
    if (!trimmed || trimmed.length < 7) return null;
    return trimmed.slice(0, 7);
}

export function validateQualificationProcedureSubmit(params: {
    employee: Employee | null | undefined;
    office: Office | null | undefined;
    company: Company | null | undefined;
    qualificationDate: string | null | undefined;
    monthlyReward: QualificationMonthlyReward | null | undefined;
}): ProcedureSubmitValidationResult {
    const common = validateCommonProcedureContext(params);
    if (common) return common;

    const employeeId = params.employee!.id;

    if (!params.qualificationDate?.trim()) {
        return missingFieldsFailure([employeeLink(employeeId, '資格取得日', 'social-insurance')]);
    }

    const qualificationDateReason = validateQualificationDateRange(
        params.qualificationDate.trim(),
        params.employee!,
    );
    if (qualificationDateReason) {
        return errorFailure(qualificationDateReason);
    }

    if (!params.monthlyReward || params.monthlyReward.totalAmount <= 0) {
        const yearMonth =
            params.monthlyReward?.targetYearMonth ?? joinYearMonth(params.employee?.joinedDate) ?? '';
        if (!yearMonth) {
            return missingFieldsFailure([employeeLink(employeeId, '入社日')]);
        }
        return missingFieldsFailure([premiumLink(employeeId, yearMonth, '入社月の報酬月額')]);
    }

    return { ok: true };
}

export function validateLossProcedureSubmit(params: {
    employee: Employee | null | undefined;
    office: Office | null | undefined;
    company: Company | null | undefined;
    lossDate: string | null | undefined;
    lossReason: LossReason | null | undefined;
    healthInsuranceStartDate?: string | null;
}): ProcedureSubmitValidationResult {
    const common = validateCommonProcedureContext(params);
    if (common) return common;

    const employeeId = params.employee!.id;
    const missing: ProcedureSubmitMissingField[] = [];

    if (!params.lossReason) {
        missing.push(employeeLink(employeeId, '資格喪失理由', 'retire-section'));
    }

    if (!params.lossDate?.trim()) {
        missing.push(
            employeeLink(
                employeeId,
                params.lossReason === 'retirement' ? '退職年月日' : '資格喪失年月日',
                'retire-section',
            ),
        );
    }

    if (missing.length > 0) {
        return missingFieldsFailure(missing);
    }

    const qualificationDate = getQualificationDate(
        params.employee!,
        params.healthInsuranceStartDate,
    );
    const lossDateReason = validateLossDateRange(params.lossDate!.trim(), qualificationDate);
    if (lossDateReason) {
        return errorFailure(lossDateReason);
    }

    return { ok: true };
}

export function validateDependentProcedureSubmit(
    changeType: 'add' | 'change' | 'delete' | null,
    form: DependentProcedureSubmitForm,
    procedureId?: string,
    options?: {
        employee?: Employee | null;
        healthInsuranceStartDate?: string | null;
        healthInsuranceEndDate?: string | null;
        dependencyStartDate?: string | null;
        dependencyEndDate?: string | null;
    },
): ProcedureSubmitValidationResult {
    if (!changeType) {
        return missingFieldsFailure([procedureFormLink(procedureId, '異動の別', 'dependent-change-type')]);
    }

    const missing: ProcedureSubmitMissingField[] = [];

    if (changeType === 'change' || changeType === 'delete') {
        if (!form.dependentId) {
            missing.push(procedureFormLink(procedureId, '被扶養者', 'dependent-select'));
        }
    }

    if (changeType === 'add' || changeType === 'change') {
        if (!form.lastName.trim() || !form.firstName.trim()) {
            missing.push(procedureFormLink(procedureId, '氏名', 'dep-last-name'));
        }
        if (!form.birthDate) {
            missing.push(procedureFormLink(procedureId, '生年月日', 'dep-birth-date'));
        }
        if (!form.gender) {
            missing.push(procedureFormLink(procedureId, '性別', 'dep-gender'));
        }
        if (!form.relationship) {
            missing.push(procedureFormLink(procedureId, '続柄', 'dep-relationship'));
        }
        if (changeType === 'add' && !form.dependencyStartDate) {
            missing.push(procedureFormLink(procedureId, '被扶養者になった日', 'dep-start-date'));
        }
        if (changeType === 'add' && !form.addReason) {
            missing.push(procedureFormLink(procedureId, '扶養追加の理由', 'dep-add-reason'));
        }
        if (changeType === 'add' && form.addReason === 'other' && !form.addReasonNote.trim()) {
            missing.push(procedureFormLink(procedureId, '記載', 'dep-add-reason-note'));
        }
        if (changeType === 'change' && !form.changeDate) {
            missing.push(procedureFormLink(procedureId, '変更した日', 'dep-change-date'));
        }
    }

    if (changeType === 'delete') {
        if (!form.dependencyEndDate) {
            missing.push(procedureFormLink(procedureId, '被扶養者でなくなった日', 'dep-end-date'));
        }
        if (!form.deleteReason) {
            missing.push(procedureFormLink(procedureId, '削除理由', 'dep-delete-reason'));
        }
    }

    if (missing.length > 0) {
        return missingFieldsFailure(missing);
    }

    if (options?.employee) {
        const bounds = resolveInsuredPeriodBounds({
            employee: options.employee,
            healthInsuranceStartDate: options.healthInsuranceStartDate,
            healthInsuranceEndDate: options.healthInsuranceEndDate,
        });
        const eventDate =
            changeType === 'add'
                ? form.dependencyStartDate.trim()
                : changeType === 'delete'
                  ? form.dependencyEndDate.trim()
                  : form.changeDate.trim();
        const occurredDateReason = validateDependentOccurredDate({
            occurredDate: eventDate,
            changeType,
            bounds,
            dependencyStartDate:
                options.dependencyStartDate
                ?? (changeType === 'add' ? form.dependencyStartDate : undefined),
            dependencyEndDate:
                options.dependencyEndDate
                ?? (changeType === 'delete' ? form.dependencyEndDate : undefined),
        });
        if (occurredDateReason) {
            return errorFailure(occurredDateReason);
        }
    }

    return { ok: true };
}

export function validateRegularDecisionProcedureSubmit(params: {
    employee: Employee | null | undefined;
    office: Office | null | undefined;
    company: Company | null | undefined;
    missingMonthlyRewardMonths: string[];
    averageMonthlyReward: number | null | undefined;
    standardRemuneration: { health: number; pension: number } | null | undefined;
}): ProcedureSubmitValidationResult {
    const common = validateCommonProcedureContext(params);
    if (common) return common;

    const employeeId = params.employee!.id;

    if (params.missingMonthlyRewardMonths.length > 0) {
        return missingFieldsFailure(
            params.missingMonthlyRewardMonths.map((yearMonth) =>
                premiumLink(employeeId, yearMonth, `${formatYearMonthLabel(yearMonth)}の報酬月額`),
            ),
        );
    }

    if (params.averageMonthlyReward === null || params.averageMonthlyReward === undefined) {
        return errorFailure('算定に必要な報酬月額が未入力です');
    }

    if (!params.standardRemuneration) {
        return errorFailure('標準報酬月額を算定できません');
    }

    return { ok: true };
}

export function validateRevisionProcedureSubmit(params: {
    employee: Employee | null | undefined;
    office: Office | null | undefined;
    company: Company | null | undefined;
    targetYearMonth: string | null | undefined;
    revisionRevisedMonthlyReward: number | null | undefined;
    revisionReason: string | null | undefined;
}): ProcedureSubmitValidationResult {
    const common = validateCommonProcedureContext(params);
    if (common) return common;

    const employeeId = params.employee!.id;

    if (!params.targetYearMonth?.trim()) {
        return errorFailure('改定年月が未入力です');
    }

    if (params.revisionRevisedMonthlyReward === null || params.revisionRevisedMonthlyReward === undefined) {
        return missingFieldsFailure([
            premiumLink(employeeId, params.targetYearMonth, '改定後の報酬月額'),
        ]);
    }

    if (!params.revisionReason?.trim()) {
        return errorFailure('改定理由が未入力です');
    }

    if (INVALID_REVISION_REASONS.has(params.revisionReason)) {
        return errorFailure(params.revisionReason);
    }

    return { ok: true };
}

export function validateBonusPaymentProcedureSubmit(params: {
    employee: Employee | null | undefined;
    office: Office | null | undefined;
    company: Company | null | undefined;
    targetYearMonth: string | null | undefined;
    bonusAmount: number | null | undefined;
    paymentDate?: string | null;
    healthInsuranceStartDate?: string | null;
    healthInsuranceEndDate?: string | null;
}): ProcedureSubmitValidationResult {
    const common = validateCommonProcedureContext(params);
    if (common) return common;

    const employeeId = params.employee!.id;

    if (!params.targetYearMonth?.trim()) {
        return errorFailure('対象年月が未入力です');
    }

    if (params.bonusAmount === null || params.bonusAmount === undefined) {
        return missingFieldsFailure([
            premiumLink(employeeId, params.targetYearMonth, '賞与額'),
        ]);
    }

    const paymentDate = params.paymentDate?.trim();
    if (paymentDate) {
        const bounds = resolveInsuredPeriodBounds({
            employee: params.employee!,
            healthInsuranceStartDate: params.healthInsuranceStartDate,
            healthInsuranceEndDate: params.healthInsuranceEndDate,
        });
        const paymentDateReason = validateDateWithinInsuredPeriod(paymentDate, bounds);
        if (paymentDateReason) {
            return errorFailure(paymentDateReason);
        }
    }

    return { ok: true };
}

export function validateProcedureSubmit(
    procedure: Procedure,
    context: {
        employee?: Employee | null;
        office?: Office | null;
        company?: Company | null;
        qualificationDate?: string | null;
        monthlyReward?: QualificationMonthlyReward | null;
        lossDate?: string | null;
        lossReason?: LossReason | null;
        healthInsuranceStartDate?: string | null;
        healthInsuranceEndDate?: string | null;
        dependentChangeType?: 'add' | 'change' | 'delete' | null;
        dependentForm?: DependentProcedureSubmitForm;
        dependentDependencyStartDate?: string | null;
        dependentDependencyEndDate?: string | null;
        missingMonthlyRewardMonths?: string[];
        averageMonthlyReward?: number | null;
        standardRemuneration?: { health: number; pension: number } | null;
        revisionRevisedMonthlyReward?: number | null;
        revisionReason?: string | null;
        bonusAmount?: number | null;
    },
): ProcedureSubmitValidationResult {
    switch (procedure.procedureType) {
        case 'qualification':
            return validateQualificationProcedureSubmit({
                employee: context.employee,
                office: context.office,
                company: context.company,
                qualificationDate: context.qualificationDate,
                monthlyReward: context.monthlyReward,
            });
        case 'loss':
            return validateLossProcedureSubmit({
                employee: context.employee,
                office: context.office,
                company: context.company,
                lossDate: context.lossDate,
                lossReason: context.lossReason ?? procedure.lossReason,
                healthInsuranceStartDate: context.healthInsuranceStartDate,
            });
        case 'dependentChange':
            return validateDependentProcedureSubmit(
                context.dependentChangeType ?? null,
                context.dependentForm ?? {
                    changeDate: '',
                    dependentId: '',
                    lastName: '',
                    firstName: '',
                    birthDate: '',
                    gender: '',
                    relationship: '',
                    dependencyStartDate: '',
                    addReason: '',
                    addReasonNote: '',
                    dependencyEndDate: '',
                    deleteReason: '',
                },
                procedure.id,
                {
                    employee: context.employee,
                    healthInsuranceStartDate: context.healthInsuranceStartDate,
                    healthInsuranceEndDate: context.healthInsuranceEndDate,
                    dependencyStartDate: context.dependentDependencyStartDate,
                    dependencyEndDate: context.dependentDependencyEndDate,
                },
            );
        case 'regularDecision':
            return validateRegularDecisionProcedureSubmit({
                employee: context.employee,
                office: context.office,
                company: context.company,
                missingMonthlyRewardMonths: context.missingMonthlyRewardMonths ?? [],
                averageMonthlyReward: context.averageMonthlyReward,
                standardRemuneration: context.standardRemuneration,
            });
        case 'revision':
            return validateRevisionProcedureSubmit({
                employee: context.employee,
                office: context.office,
                company: context.company,
                targetYearMonth: procedure.targetYearMonth,
                revisionRevisedMonthlyReward: context.revisionRevisedMonthlyReward,
                revisionReason: context.revisionReason,
            });
        case 'bonusPayment':
            return validateBonusPaymentProcedureSubmit({
                employee: context.employee,
                office: context.office,
                company: context.company,
                targetYearMonth: procedure.targetYearMonth,
                bonusAmount: context.bonusAmount,
                paymentDate: procedure.occurredDate,
                healthInsuranceStartDate: context.healthInsuranceStartDate,
                healthInsuranceEndDate: context.healthInsuranceEndDate,
            });
        default:
            return errorFailure('この手続きは提出済みにできません');
    }
}

function formatYearMonthLabel(yearMonth: string): string {
    const month = Number(yearMonth.slice(5, 7));
    return Number.isFinite(month) ? `${month}月` : yearMonth;
}
