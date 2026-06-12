import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { Company } from '../../company/models/company.model';
import { Office } from '../../company/models/office.model';
import { Dependent, Employee } from '../../employee/models/employee.models';
import { convertRowsToCsv } from '../../../shared/components/utils/csv.utils';
import { createBonusPaymentCsvRow } from '../exports/bonus-payment-exports';
import { createDependentChangeCsvRow } from '../exports/dependent-changes-exports';
import {
    createMonthlyRevisionCsvRow,
    MonthlyRevisionMonthExport,
} from '../exports/monthly-revision-exports';
import { createQualificationAcquisitionCsvRow } from '../exports/qualification-acquisition-export';
import { createQualificationLossCsvRow } from '../exports/qualification-loss-exports';
import {
    createRegularDecisionCsvRow,
    RegularDecisionMonthExport,
} from '../exports/regular-decision-exports';
import { Procedure, ProcedureType } from '../models/procedures.model';
import { procedureTypeLabel } from './procedure-display.util';

export type ProcedureCsvExportContext = {
    lossDate?: string | null;
    dependent?: Dependent | null;
    bonusReward?: BonusReward | null;
    regularDecision?: {
        averageMonthlyReward: number;
        healthStandardAmount: number;
        pensionStandardAmount: number;
        effectiveFrom: string;
        months: RegularDecisionMonthExport[];
    };
    revision?: {
        fixedWageChangeMonth: string;
        changeDescription: string;
        previousStandardAmount: number;
        revisedStandardAmount: number;
        effectiveFrom: string;
        months: MonthlyRevisionMonthExport[];
    };
};

export type ProcedureCsvExportResult =
    | { ok: true; csvText: string; fileName: string }
    | { ok: false; error: string };

const EXPORTABLE_TYPES: ProcedureType[] = [
    'qualification',
    'loss',
    'dependentChange',
    'regularDecision',
    'revision',
    'bonusPayment',
];

export function canExportProcedureCsv(type: ProcedureType): boolean {
    return EXPORTABLE_TYPES.includes(type);
}

export function buildProcedureCsvExport(params: {
    procedure: Procedure;
    company?: Company | null;
    office?: Office | null;
    employee?: Employee | null;
    procedureForExport?: Procedure | null;
    context?: ProcedureCsvExportContext;
}): ProcedureCsvExportResult {
    const procedure = params.procedureForExport ?? params.procedure;
    const { company, office, employee, context = {} } = params;

    if (!canExportProcedureCsv(procedure.procedureType)) {
        return { ok: false, error: 'この手続きではCSV出力に対応していません' };
    }

    try {
        switch (procedure.procedureType) {
            case 'qualification': {
                if (!company || !office || !employee) {
                    return { ok: false, error: 'CSV出力に必要な情報が不足しています' };
                }
                const row = createQualificationAcquisitionCsvRow({
                    company,
                    office,
                    employee,
                    procedure,
                });
                return success(row, procedure, employee);
            }

            case 'loss': {
                if (!company || !office || !employee) {
                    return { ok: false, error: 'CSV出力に必要な情報が不足しています' };
                }
                const row = createQualificationLossCsvRow({
                    company,
                    office,
                    employee,
                    procedure,
                    lossDate: context.lossDate,
                });
                return success(row, procedure, employee);
            }

            case 'dependentChange': {
                if (!company || !office || !employee) {
                    return { ok: false, error: 'CSV出力に必要な情報が不足しています' };
                }
                if (!procedure.dependentChanges) {
                    return { ok: false, error: '扶養の異動内容が未入力です' };
                }
                const row = createDependentChangeCsvRow({
                    company,
                    office,
                    employee,
                    procedure,
                    dependent: context.dependent,
                });
                return success(row, procedure, employee);
            }

            case 'regularDecision': {
                if (!office || !employee || !context.regularDecision) {
                    return { ok: false, error: '算定基礎届の出力データが不足しています' };
                }
                const row = createRegularDecisionCsvRow({
                    office,
                    employee,
                    procedure,
                    ...context.regularDecision,
                });
                return success(row, procedure, employee);
            }

            case 'revision': {
                if (!office || !employee || !context.revision) {
                    return { ok: false, error: '月額変更届の出力データが不足しています' };
                }
                const row = createMonthlyRevisionCsvRow({
                    office,
                    employee,
                    procedure,
                    ...context.revision,
                });
                return success(row, procedure, employee);
            }

            case 'bonusPayment': {
                if (!office || !employee || !context.bonusReward) {
                    return { ok: false, error: '賞与支払届の出力データが不足しています' };
                }
                const row = createBonusPaymentCsvRow({
                    office,
                    employee,
                    bonusReward: context.bonusReward,
                    procedure,
                });
                return success(row, procedure, employee);
            }

            default:
                return { ok: false, error: 'この手続きではCSV出力に対応していません' };
        }
    } catch (error) {
        console.error('CSV出力の生成に失敗しました', error);
        return { ok: false, error: 'CSV出力の生成に失敗しました' };
    }
}

function success(
    row: Record<string, string | number>,
    procedure: Procedure,
    employee: Employee,
): ProcedureCsvExportResult {
    const csvText = convertRowsToCsv([row]);
    const employeeName = `${employee.lastName}${employee.firstName}`;
    const typeLabel = procedureTypeLabel(procedure.procedureType).replace(/\s/g, '');
    const date =
        procedure.qualificationDate ||
        procedure.occurredDate ||
        procedure.targetYearMonth ||
        procedure.completedDate ||
        'export';

    return {
        ok: true,
        csvText,
        fileName: `${typeLabel}_${employeeName}_${date}.csv`,
    };
}
