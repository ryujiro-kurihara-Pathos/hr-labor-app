import { Company } from '../../company/models/company.model';
import { Office } from '../../company/models/office.model';
import { Dependent, Employee } from '../../employee/models/employee.models';
import { resolveInsuredPersonNumberForExport } from '../../employee/utils/insured-person-number.util';
import { Procedure } from '../models/procedures.model';
import {
    dependentAddReasonDisplayText,
    dependentChangeTypeLabel,
    dependentDeleteReasonLabel,
    dependentRelationshipLabel,
} from '../utils/dependent-procedure-data.util';

export type DependentChangeCsvRow = {
    事業所整理記号: string;
    事業所番号: string;
    事業所所在地: string;
    事業所名称: string;
    事業主氏名: string;
    電話番号: string;

    被保険者整理番号: string;
    被保険者氏名: string;
    被保険者フリガナ: string;
    被保険者生年月日: string;
    被保険者個人番号登録状況: string;

    被扶養者氏名: string;
    続柄: string;
    被扶養者生年月日: string;
    被扶養者個人番号登録状況: string;

    異動区分: string;
    異動日: string;
    異動理由: string;
};

export function createDependentChangeCsvRow(params: {
    company: Company;
    office: Office;
    employee: Employee;
    procedure: Procedure;
    dependent?: Dependent | null;
}): DependentChangeCsvRow {
    const { company, office, employee, procedure, dependent } = params;
    const changeType = procedure.dependentChanges;

    const dependentLastName = dependent?.lastName ?? procedure.dependentLastName;
    const dependentFirstName = dependent?.firstName ?? procedure.dependentFirstName;
    const dependentBirthDate = dependent?.birthDate ?? procedure.dependentBirthDate;
    const dependentMyNumber = dependent?.myNumber ?? procedure.dependentMyNumber;
    const dependentRelationship = dependent?.relationship ?? procedure.dependentRelationship;

    const changeDate =
        changeType === 'delete'
            ? procedure.dependencyEndDate
            : procedure.dependencyStartDate;

    const changeReason =
        changeType === 'add'
            ? dependentAddReasonDisplayText(
                procedure.dependentAddReason,
                procedure.dependentAddReasonNote,
            )
            : changeType === 'delete'
              ? dependentDeleteReasonLabel(procedure.dependentDeleteReason)
              : '—';

    return {
        事業所整理記号: office.officeSymbol,
        事業所番号: office.officeNumber,
        事業所所在地: `${office.prefecture}${office.city}${office.streetAddress}`,
        事業所名称: office.name,
        事業主氏名: company.representativeName,
        電話番号: office.phoneNumber,

        被保険者整理番号: resolveInsuredPersonNumberForExport(employee),
        被保険者氏名: `${employee.lastName} ${employee.firstName}`,
        被保険者フリガナ: `${employee.lastNameKana} ${employee.firstNameKana}`,
        被保険者生年月日: employee.birthDate,
        被保険者個人番号登録状況: employee.myNumber ? '登録済み' : '未登録',

        被扶養者氏名: `${dependentLastName} ${dependentFirstName}`.trim(),
        続柄: dependentRelationshipLabel(dependentRelationship),
        被扶養者生年月日: dependentBirthDate,
        被扶養者個人番号登録状況: dependentMyNumber ? '登録済み' : '未登録',

        異動区分: dependentChangeTypeLabel(changeType),
        異動日: changeDate,
        異動理由: changeReason,
    };
}
