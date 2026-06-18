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

export type ProcedureSubmitValidationResult =
    | { ok: true }
    | { ok: false; message: string };

export const PROCEDURE_SUBMIT_MISSING_FIELDS_MESSAGE = '未入力の項目があります';

export type DependentProcedureSubmitForm = {
    dependentId: string;
    lastName: string;
    firstName: string;
    birthDate: string;
    gender: string;
    relationship: string;
    dependencyStartDate: string;
    addReason: DependentAddReason | '';
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

function failure(message: string): ProcedureSubmitValidationResult {
    return { ok: false, message };
}

function missingFieldsMessage(fields: string[]): ProcedureSubmitValidationResult {
    return failure('未入力の項目があります');
}

function collectMissingFields(labels: Record<string, boolean>): string[] {
    return Object.entries(labels)
        .filter(([, present]) => !present)
        .map(([label]) => label);
}

function validateOfficeFields(office: Office | null | undefined): string[] {
    if (!office) return ['事業所情報'];
    return collectMissingFields({
        事業所整理記号: Boolean(office.officeSymbol?.trim()),
        事業所番号: Boolean(office.officeNumber?.trim()),
        事業所名称: Boolean(office.name?.trim()),
        都道府県: Boolean(office.prefecture?.trim()),
    });
}

function validateCompanyFields(company: Company | null | undefined): string[] {
    if (!company) return ['会社情報'];
    return collectMissingFields({
        会社名: Boolean(company.name?.trim()),
        事業主氏名: Boolean(company.representativeName?.trim()),
    });
}

function validateEmployeeFields(employee: Employee | null | undefined): string[] {
    if (!employee) return ['被保険者情報'];
    return collectMissingFields({
        氏名: Boolean(employee.lastName?.trim() && employee.firstName?.trim()),
        '氏名（カナ）': Boolean(employee.lastNameKana?.trim() && employee.firstNameKana?.trim()),
        生年月日: Boolean(employee.birthDate?.trim()),
        性別: Boolean(employee.gender),
        '住所（都道府県）': Boolean(employee.prefecture?.trim()),
        '住所（市区町村）': Boolean(employee.city?.trim()),
        '住所（町名・番地）': Boolean(employee.streetAddress?.trim()),
    });
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
    return missingFieldsMessage(missing);
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

    if (!params.qualificationDate?.trim()) {
        return failure('資格取得日が未入力です');
    }

    if (!params.monthlyReward || params.monthlyReward.totalAmount <= 0) {
        return failure('入社月の報酬月額が未登録です');
    }

    return { ok: true };
}

export function validateLossProcedureSubmit(params: {
    employee: Employee | null | undefined;
    office: Office | null | undefined;
    company: Company | null | undefined;
    lossDate: string | null | undefined;
    lossReason: LossReason | null | undefined;
}): ProcedureSubmitValidationResult {
    const common = validateCommonProcedureContext(params);
    if (common) return common;

    if (!params.lossReason) {
        return failure('資格喪失理由が未入力です');
    }

    if (!params.lossDate?.trim()) {
        if (params.lossReason === 'retirement') {
            return failure('退職年月日が未入力です');
        }
        return failure('資格喪失年月日が未入力です');
    }

    return { ok: true };
}

export function validateDependentProcedureSubmit(
    changeType: 'add' | 'change' | 'delete',
    form: DependentProcedureSubmitForm,
): ProcedureSubmitValidationResult {
    if (changeType === 'change' || changeType === 'delete') {
        if (!form.dependentId) return failure('被扶養者を選択してください');
    }

    if (changeType === 'add' || changeType === 'change') {
        if (!form.lastName.trim() || !form.firstName.trim()) return failure('氏名を入力してください');
        if (!form.birthDate) return failure('生年月日を入力してください');
        if (!form.gender) return failure('性別を選択してください');
        if (!form.relationship) return failure('続柄を選択してください');
        if (changeType === 'add' && !form.dependencyStartDate) {
            return failure('被扶養者になった日を入力してください');
        }
        if (changeType === 'add' && !form.addReason) return failure('理由を選択してください');
    }

    if (changeType === 'delete') {
        if (!form.dependencyEndDate) return failure('被扶養者でなくなった日を入力してください');
        if (!form.deleteReason) return failure('理由を選択してください');
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

    if (params.missingMonthlyRewardMonths.length > 0) {
        const labels = params.missingMonthlyRewardMonths.map(formatYearMonthLabel).join('、');
        return failure(`${labels}の報酬月額が未入力です`);
    }

    if (params.averageMonthlyReward === null || params.averageMonthlyReward === undefined) {
        return failure('算定に必要な報酬月額が未入力です');
    }

    if (!params.standardRemuneration) {
        return failure('標準報酬月額を算定できません');
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

    if (!params.targetYearMonth?.trim()) {
        return failure('改定年月が未入力です');
    }

    if (params.revisionRevisedMonthlyReward === null || params.revisionRevisedMonthlyReward === undefined) {
        return failure('改定後の報酬月額が未入力です');
    }

    if (!params.revisionReason?.trim()) {
        return failure('改定理由が未入力です');
    }

    if (INVALID_REVISION_REASONS.has(params.revisionReason)) {
        return failure(params.revisionReason);
    }

    return { ok: true };
}

export function validateBonusPaymentProcedureSubmit(params: {
    employee: Employee | null | undefined;
    office: Office | null | undefined;
    company: Company | null | undefined;
    targetYearMonth: string | null | undefined;
    bonusAmount: number | null | undefined;
}): ProcedureSubmitValidationResult {
    const common = validateCommonProcedureContext(params);
    if (common) return common;

    if (!params.targetYearMonth?.trim()) {
        return failure('対象年月が未入力です');
    }

    if (params.bonusAmount === null || params.bonusAmount === undefined) {
        return failure('賞与額が未登録です');
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
        dependentChangeType?: 'add' | 'change' | 'delete' | null;
        dependentForm?: DependentProcedureSubmitForm;
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
            });
        case 'dependentChange':
            if (!context.dependentChangeType || !context.dependentForm) {
                return failure('異動の別を選択してください');
            }
            return validateDependentProcedureSubmit(context.dependentChangeType, context.dependentForm);
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
            });
        default:
            return failure('この手続きは提出済みにできません');
    }
}

function formatYearMonthLabel(yearMonth: string): string {
    const month = Number(yearMonth.slice(5, 7));
    return Number.isFinite(month) ? `${month}月` : yearMonth;
}
