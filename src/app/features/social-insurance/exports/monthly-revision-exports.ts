import { Office } from '../../company/models/office.model';
import { Employee } from '../../employee/models/employee.models';
import { resolveInsuredPersonNumberForExport } from '../../employee/utils/insured-person-number.util';
import { Procedure } from '../models/procedures.model';

export type MonthlyRevisionMonthExport = {
    yearMonth: string;
    totalAmount: number;
    paymentBaseDays: number;
};

export type MonthlyRevisionCsvRow = {
    事業所整理記号: string;
    事業所番号: string;
    事業所名称: string;

    被保険者整理番号: string;
    氏名: string;
    生年月日: string;

    固定的賃金変更月: string;
    変更内容: string;

    一月目対象月: string;
    一月目報酬月額: number;
    一月目支払基礎日数: number;

    二月目対象月: string;
    二月目報酬月額: number;
    二月目支払基礎日数: number;

    三月目対象月: string;
    三月目報酬月額: number;
    三月目支払基礎日数: number;

    従前標準報酬月額: number;
    改定後標準報酬月額: number;
    改定開始年月: string;
};

export function createMonthlyRevisionCsvRow(params: {
    office: Office;
    employee: Employee;
    procedure: Procedure;
    fixedWageChangeMonth: string;
    changeDescription: string;
    previousStandardAmount: number;
    revisedStandardAmount: number;
    effectiveFrom: string;
    months: MonthlyRevisionMonthExport[];
}): MonthlyRevisionCsvRow {
    const { office, employee, procedure, months } = params;
    const m1 = months[0] ?? { yearMonth: '', totalAmount: 0, paymentBaseDays: 0 };
    const m2 = months[1] ?? { yearMonth: '', totalAmount: 0, paymentBaseDays: 0 };
    const m3 = months[2] ?? { yearMonth: '', totalAmount: 0, paymentBaseDays: 0 };

    return {
        事業所整理記号: office.officeSymbol,
        事業所番号: office.officeNumber,
        事業所名称: office.name,

        被保険者整理番号: resolveInsuredPersonNumberForExport(employee),
        氏名: `${employee.lastName} ${employee.firstName}`,
        生年月日: employee.birthDate,

        固定的賃金変更月: params.fixedWageChangeMonth,
        変更内容: params.changeDescription,

        一月目対象月: m1.yearMonth,
        一月目報酬月額: m1.totalAmount,
        一月目支払基礎日数: m1.paymentBaseDays,

        二月目対象月: m2.yearMonth,
        二月目報酬月額: m2.totalAmount,
        二月目支払基礎日数: m2.paymentBaseDays,

        三月目対象月: m3.yearMonth,
        三月目報酬月額: m3.totalAmount,
        三月目支払基礎日数: m3.paymentBaseDays,

        従前標準報酬月額: params.previousStandardAmount,
        改定後標準報酬月額: params.revisedStandardAmount,
        改定開始年月: params.effectiveFrom || procedure.targetYearMonth || '',
    };
}
