import { Office } from '../../company/models/office.model';
import { Employee } from '../../employee/models/employee.models';
import { resolveInsuredPersonNumberForExport } from '../../employee/utils/insured-person-number.util';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { Procedure } from '../models/procedures.model';

export type BonusPaymentCsvRow = {
    事業所整理記号: string;
    事業所番号: string;
    事業所名称: string;

    被保険者整理番号: string;
    氏名: string;
    生年月日: string;

    賞与支払年月日: string;
    賞与支給額: number;
    標準賞与額: number;

    健康保険対象: string;
    厚生年金対象: string;
    介護保険対象: string;
};

export function createBonusPaymentCsvRow(params: {
    office: Office;
    employee: Employee;
    bonusReward: BonusReward;
    procedure: Procedure;
}): BonusPaymentCsvRow {
    const { office, employee, bonusReward } = params;
    const isTarget = bonusReward.bonusAmount > 0;

    return {
        事業所整理記号: office.officeSymbol,
        事業所番号: office.officeNumber,
        事業所名称: office.name,

        被保険者整理番号: resolveInsuredPersonNumberForExport(employee),
        氏名: `${employee.lastName} ${employee.firstName}`,
        生年月日: employee.birthDate,

        賞与支払年月日: bonusReward.paymentDate,
        賞与支給額: bonusReward.bonusAmount,
        標準賞与額: bonusReward.standardBonusAmount,

        健康保険対象: isTarget ? '対象' : '対象外',
        厚生年金対象: isTarget ? '対象' : '対象外',
        介護保険対象: isTarget ? '対象' : '対象外',
    };
}
