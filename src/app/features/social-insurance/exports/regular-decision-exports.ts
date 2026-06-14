import { Office } from '../../company/models/office.model';
import { Employee } from '../../employee/models/employee.models';
import { resolveInsuredPersonNumberForExport } from '../../employee/utils/insured-person-number.util';
import { Procedure } from '../models/procedures.model';

export type RegularDecisionMonthExport = {
    totalAmount: number;
    paymentBaseDays: number;
};

export type RegularDecisionCsvRow = {
    事業所整理記号: string;
    事業所番号: string;
    事業所名称: string;

    被保険者整理番号: string;
    氏名: string;
    生年月日: string;

    対象年: string;

    四月報酬月額: number;
    四月支払基礎日数: number;
    五月報酬月額: number;
    五月支払基礎日数: number;
    六月報酬月額: number;
    六月支払基礎日数: number;

    平均報酬月額: number;
    健康保険標準報酬月額: number;
    厚生年金標準報酬月額: number;

    適用開始年月: string;
};

export function createRegularDecisionCsvRow(params: {
    office: Office;
    employee: Employee;
    procedure: Procedure;
    averageMonthlyReward: number;
    healthStandardAmount: number;
    pensionStandardAmount: number;
    effectiveFrom: string;
    months: RegularDecisionMonthExport[];
}): RegularDecisionCsvRow {
    const { office, employee, procedure, months } = params;
    const april = months[0] ?? { totalAmount: 0, paymentBaseDays: 0 };
    const may = months[1] ?? { totalAmount: 0, paymentBaseDays: 0 };
    const june = months[2] ?? { totalAmount: 0, paymentBaseDays: 0 };

    return {
        事業所整理記号: office.officeSymbol,
        事業所番号: office.officeNumber,
        事業所名称: office.name,

        被保険者整理番号: resolveInsuredPersonNumberForExport(employee),
        氏名: `${employee.lastName} ${employee.firstName}`,
        生年月日: employee.birthDate,

        対象年: procedure.targetYearMonth?.slice(0, 4) ?? '',

        四月報酬月額: april.totalAmount,
        四月支払基礎日数: april.paymentBaseDays,
        五月報酬月額: may.totalAmount,
        五月支払基礎日数: may.paymentBaseDays,
        六月報酬月額: june.totalAmount,
        六月支払基礎日数: june.paymentBaseDays,

        平均報酬月額: params.averageMonthlyReward,
        健康保険標準報酬月額: params.healthStandardAmount,
        厚生年金標準報酬月額: params.pensionStandardAmount,

        適用開始年月: params.effectiveFrom,
    };
}
