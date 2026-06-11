import { Dependent } from '../../employee/models/employee.models';
import {
    DEPENDENT_ADD_REASON_LABELS,
    DEPENDENT_DELETE_REASON_LABELS,
    DependentProcedureData,
    Procedure,
} from '../models/procedures.model';

export function hasSavedDependentData(procedure: Procedure): boolean {
    return procedure.procedureType === 'dependentChange' && Boolean(procedure.dependentChanges);
}

export function dependentAddReasonLabel(value: string | null | undefined): string {
    if (!value) return '—';
    return DEPENDENT_ADD_REASON_LABELS[value as keyof typeof DEPENDENT_ADD_REASON_LABELS] ?? value;
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
        dependencyStartDate: dependent.dependencyStartDate,
        dependentAddReason: '',
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
    dependencyStartDate: string;
} {
    return {
        dependentId: dependent.id,
        lastName: dependent.lastName,
        firstName: dependent.firstName,
        birthDate: dependent.birthDate,
        gender: dependent.gender ?? '',
        relationship: dependent.relationship,
        myNumber: dependent.myNumber ?? '',
        address: dependent.address ?? '',
        occupation: dependent.occupation ?? '',
        income: dependent.income ?? '',
        dependencyStartDate: dependent.dependencyStartDate,
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
        dependencyStartDate: procedure.dependencyStartDate,
        dependentAddReason: procedure.dependentAddReason,
        dependencyEndDate: procedure.dependencyEndDate,
        dependentDeleteReason: procedure.dependentDeleteReason,
    };
}
