import { Dependent } from '../../employee/models/employee.models';
import {
    DEPENDENT_ADD_REASON_LABELS,
    DEPENDENT_DELETE_REASON_LABELS,
    DependentAddReason,
    DependentDeleteReason,
    DependentProcedureData,
    Procedure,
} from '../models/procedures.model';
import { resolveDependentChangeOccurredAndDueDate } from './procedure-due-date.util';

export type DependentProcedureFormState = {
    changeDate: string;
    dependentId: string;
    lastName: string;
    firstName: string;
    birthDate: string;
    gender: 'male' | 'female' | '';
    relationship: Dependent['relationship'] | '';
    myNumber: string;
    address: string;
    occupation: string;
    income: number | '';
    isDisabled: boolean;
    dependencyStartDate: string;
    addReason: DependentAddReason | '';
    addReasonNote: string;
    dependencyEndDate: string;
    deleteReason: DependentDeleteReason | '';
};

export function generateMyNumber(): string {
    return Math.floor(Math.random() * 1_000_000_000_000).toString().padStart(12, '0');
}

/** 登録済みの個人番号があればそれを使い、なければ仮番号を生成する */
export function resolveDependentFormMyNumber(value: string | null | undefined): string {
    const trimmed = value?.trim() ?? '';
    return trimmed || generateMyNumber();
}

export function hasSavedDependentData(procedure: Procedure): boolean {
    return procedure.procedureType === 'dependentChange' && Boolean(procedure.dependentChanges);
}

export function dependentAddReasonLabel(value: string | null | undefined): string {
    if (!value) return '—';
    const labels = DEPENDENT_ADD_REASON_LABELS as Record<string, string>;
    if (labels[value]) return labels[value];
    const legacyLabels: Record<string, string> = {
        cohabitation: '同居',
    };
    return legacyLabels[value] ?? value;
}

export function dependentAddReasonDisplayText(
    reason: DependentAddReason | '' | null | undefined,
    note?: string | null,
): string {
    if (!reason) return '—';
    const label = dependentAddReasonLabel(reason);
    if (reason === 'other' && note?.trim()) {
        return `${label}：${note.trim()}`;
    }
    return label;
}

export function dependentDeleteReasonLabel(value: string | null | undefined): string {
    if (!value) return '—';
    return DEPENDENT_DELETE_REASON_LABELS[value as keyof typeof DEPENDENT_DELETE_REASON_LABELS] ?? value;
}

export function dependentRelationshipLabel(value: string | null | undefined): string {
    const labels: Record<string, string> = {
        spouse: '配偶者',
        child: '子',
        parent: '父母',
        other: 'その他',
    };
    if (!value) return '—';
    return labels[value] ?? value;
}

export function dependentChangeEventDateLabel(changeType: Procedure['dependentChanges']): string {
    if (changeType === 'add') return '被扶養者になった日';
    if (changeType === 'delete') return '被扶養者でなくなった日';
    if (changeType === 'change') return '変更した日';
    return '異動日';
}

export function dependentChangeEventDateValue(
    changeType: Procedure['dependentChanges'],
    procedure: Pick<Procedure, 'occurredDate' | 'dependencyStartDate' | 'dependencyEndDate'>,
): string {
    if (changeType === 'add') return procedure.dependencyStartDate || procedure.occurredDate;
    if (changeType === 'delete') return procedure.dependencyEndDate || procedure.occurredDate;
    return procedure.occurredDate;
}

export function dependentChangeTypeLabel(value: Procedure['dependentChanges']): string {
    const labels = { add: '追加', change: '変更', delete: '削除' };
    if (!value) return '—';
    return labels[value];
}

export function dependentDisplayName(data: Pick<DependentProcedureData, 'dependentLastName' | 'dependentFirstName'>): string {
    const name = `${data.dependentLastName} ${data.dependentFirstName}`.trim();
    return name || '—';
}

export function dependentFromRecord(dependent: Dependent): Partial<DependentProcedureData> {
    return {
        dependentId: dependent.id,
        dependentLastName: dependent.lastName,
        dependentFirstName: dependent.firstName,
        dependentBirthDate: dependent.birthDate,
        dependentGender: dependent.gender ?? '',
        dependentRelationship: dependent.relationship,
        dependentMyNumber: dependent.myNumber ?? '',
        dependentAddress: dependent.address ?? '',
        dependentOccupation: dependent.occupation ?? '',
        dependentIncome: dependent.income ?? null,
        dependentIsDisabled: dependent.isDisabled ?? false,
        dependencyStartDate: dependent.dependencyStartDate,
        dependentAddReason: '',
        dependentAddReasonNote: '',
        dependencyEndDate: dependent.dependencyEndDate ?? '',
        dependentDeleteReason: '',
    };
}

/** 扶養家族レコードを被扶養者異動届フォームの項目名に変換する */
export function dependentToFormFields(dependent: Dependent): {
    dependentId: string;
    lastName: string;
    firstName: string;
    birthDate: string;
    gender: 'male' | 'female' | '';
    relationship: Dependent['relationship'];
    myNumber: string;
    address: string;
    occupation: string;
    income: number | '';
    isDisabled: boolean;
    dependencyStartDate: string;
} {
    return {
        dependentId: dependent.id,
        lastName: dependent.lastName,
        firstName: dependent.firstName,
        birthDate: dependent.birthDate,
        gender: dependent.gender ?? '',
        relationship: dependent.relationship,
        myNumber: resolveDependentFormMyNumber(dependent.myNumber),
        address: dependent.address ?? '',
        occupation: dependent.occupation ?? '',
        income: dependent.income ?? '',
        isDisabled: dependent.isDisabled ?? false,
        dependencyStartDate: dependent.dependencyStartDate,
    };
}

/** 被扶養者異動届の下書き保存用ペイロード（従業員の扶養家族レコードは更新しない） */
export function buildDependentProcedureDraftUpdate(
    procedure: Procedure,
    changeType: 'add' | 'change' | 'delete',
    form: DependentProcedureFormState,
): Procedure {
    const procedureDates = resolveDependentChangeOccurredAndDueDate({
        changeType,
        changeDate: form.changeDate,
        dependencyStartDate: form.dependencyStartDate,
        dependencyEndDate: form.dependencyEndDate,
    });

    return {
        ...procedure,
        status: procedure.status === 'completed' ? 'completed' : 'inProgress',
        occurredDate: procedureDates?.occurredDate ?? form.changeDate ?? procedure.occurredDate,
        dueDate: procedureDates?.dueDate ?? procedure.dueDate,
        dependentChanges: changeType,
        dependentId: form.dependentId || null,
        dependentLastName: form.lastName,
        dependentFirstName: form.firstName,
        dependentBirthDate: form.birthDate,
        dependentGender: form.gender,
        dependentRelationship: form.relationship,
        dependentMyNumber: form.myNumber,
        dependentAddress: form.address,
        dependentOccupation: form.occupation,
        dependentIncome: form.income === '' ? null : Number(form.income),
        dependentIsDisabled: form.isDisabled,
        dependencyStartDate: changeType === 'delete' ? '' : form.dependencyStartDate,
        dependentAddReason: changeType === 'add' ? form.addReason : '',
        dependentAddReasonNote: changeType === 'add' && form.addReason === 'other' ? form.addReasonNote : '',
        dependencyEndDate: changeType === 'delete' ? form.dependencyEndDate : '',
        dependentDeleteReason: changeType === 'delete' ? form.deleteReason : '',
    };
}

export function extractDependentProcedureData(procedure: Procedure): DependentProcedureData {
    return {
        dependentId: procedure.dependentId,
        dependentLastName: procedure.dependentLastName,
        dependentFirstName: procedure.dependentFirstName,
        dependentBirthDate: procedure.dependentBirthDate,
        dependentGender: procedure.dependentGender,
        dependentRelationship: procedure.dependentRelationship,
        dependentMyNumber: procedure.dependentMyNumber,
        dependentAddress: procedure.dependentAddress,
        dependentOccupation: procedure.dependentOccupation,
        dependentIncome: procedure.dependentIncome,
        dependentIsDisabled: procedure.dependentIsDisabled,
        dependencyStartDate: procedure.dependencyStartDate,
        dependentAddReason: procedure.dependentAddReason,
        dependentAddReasonNote: procedure.dependentAddReasonNote,
        dependencyEndDate: procedure.dependencyEndDate,
        dependentDeleteReason: procedure.dependentDeleteReason,
    };
}
