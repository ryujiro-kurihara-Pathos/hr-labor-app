import { Company } from '../../company/models/company.model';
import { Office } from '../../company/models/office.model';
import { Employee } from '../../employee/models/employee.models';
import { resolveInsuredPersonNumberForExport } from '../../employee/utils/insured-person-number.util';
import { Procedure } from '../models/procedures.model';
import { lossReasonLabel } from '../utils/procedure-display.util';

export type QualificationLossCsvRow = {
    事業所整理記号: string;
    事業所番号: string;
    事業所所在地: string;
    事業所名称: string;
    事業主氏名: string;
    電話番号: string;

    被保険者整理番号: string;
    氏名: string;
    フリガナ: string;
    生年月日: string;
    個人番号登録状況: string;

    退職日: string;
    資格喪失日: string;
    喪失原因: string;
    最終保険料対象月: string;
};

export function createQualificationLossCsvRow(params: {
    company: Company;
    office: Office;
    employee: Employee;
    procedure: Procedure;
    lossDate?: string | null;
}): QualificationLossCsvRow {
    const { company, office, employee, procedure, lossDate } = params;
    const lossDateValue = lossDate || procedure.occurredDate || '';

    return {
        事業所整理記号: office.officeSymbol,
        事業所番号: office.officeNumber,
        事業所所在地: `${office.prefecture}${office.city}${office.streetAddress}`,
        事業所名称: office.name,
        事業主氏名: company.representativeName,
        電話番号: office.phoneNumber,

        被保険者整理番号: resolveInsuredPersonNumberForExport(employee),
        氏名: `${employee.lastName} ${employee.firstName}`,
        フリガナ: `${employee.lastNameKana} ${employee.firstNameKana}`,
        生年月日: employee.birthDate,
        個人番号登録状況: employee.myNumber ? '登録済み' : '未登録',

        退職日: employee.retiredDate ? formatTimestampDate(employee.retiredDate) : lossDateValue,
        資格喪失日: lossDateValue,
        喪失原因: lossReasonLabel(procedure.lossReason),
        最終保険料対象月: procedure.targetYearMonth ?? '',
    };
}

function formatTimestampDate(timestamp: { toDate: () => Date }): string {
    const date = timestamp.toDate();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
