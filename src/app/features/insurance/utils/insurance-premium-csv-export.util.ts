import { Employee } from '../../employee/models/employee.models';
import { InsurancePremiumCollectionTiming } from '../../company/models/company.model';
import { resolvePremiumLiabilityYearMonth } from '../../company/utils/company-payroll-settings.util';
import { convertRowsToCsv, downloadCsv } from '../../../shared/components/utils/csv.utils';
import { CalculatedInsurancePremium } from '../services/insurance-premium-calculation.service';

export type InsurancePremiumCsvExportRow = {
    給与控除月: string;
    保険料対象月: string;
    社員番号: string;
    氏名: string;
    事業所: string;
    標準報酬月額_健康保険: number | '';
    標準報酬月額_厚生年金: number | '';
    '月次報酬_健康保険料_本人': number;
    '月次報酬_健康保険料_会社': number;
    '月次報酬_厚生年金保険料_本人': number;
    '月次報酬_厚生年金保険料_会社': number;
    '月次報酬_介護保険料_本人': number;
    '月次報酬_介護保険料_会社': number;
    月次報酬_本人負担合計: number;
    月次報酬_会社負担合計: number;
    '賞与_健康保険料_本人': number;
    '賞与_健康保険料_会社': number;
    '賞与_厚生年金保険料_本人': number;
    '賞与_厚生年金保険料_会社': number;
    '賞与_介護保険料_本人': number;
    '賞与_介護保険料_会社': number;
    賞与_本人負担合計: number;
    賞与_会社負担合計: number;
    本人負担合計: number;
    会社負担合計: number;
};

export type InsurancePremiumCsvExportItem = {
    employee: Employee;
    officeName: string;
    payYearMonth: string;
    premium: CalculatedInsurancePremium;
};

export function createInsurancePremiumCsvRow(
    item: InsurancePremiumCsvExportItem,
    collectionTiming: InsurancePremiumCollectionTiming,
): InsurancePremiumCsvExportRow {
    const { employee, officeName, payYearMonth, premium } = item;
    const liabilityYearMonth = resolvePremiumLiabilityYearMonth(payYearMonth, collectionTiming);

    return {
        給与控除月: payYearMonth,
        保険料対象月: liabilityYearMonth,
        社員番号: employee.employeeNumber ?? '',
        氏名: `${employee.lastName} ${employee.firstName}`,
        事業所: officeName,
        標準報酬月額_健康保険: premium.standardMonthlyAmount ?? '',
        標準報酬月額_厚生年金: premium.pensionStandardMonthlyAmount ?? '',
        '月次報酬_健康保険料_本人': premium.healthInsuranceEmployeePremium,
        '月次報酬_健康保険料_会社': premium.healthInsuranceEmployerPremium,
        '月次報酬_厚生年金保険料_本人': premium.pensionInsuranceEmployeePremium,
        '月次報酬_厚生年金保険料_会社': premium.pensionInsuranceEmployerPremium,
        '月次報酬_介護保険料_本人': premium.careInsuranceEmployeePremium,
        '月次報酬_介護保険料_会社': premium.careInsuranceEmployerPremium,
        月次報酬_本人負担合計: premium.monthlyEmployeePremiumTotal,
        月次報酬_会社負担合計: premium.monthlyEmployerPremiumTotal,
        '賞与_健康保険料_本人': premium.bonusHealthInsuranceEmployeePremium,
        '賞与_健康保険料_会社': premium.bonusHealthInsuranceEmployerPremium,
        '賞与_厚生年金保険料_本人': premium.bonusPensionInsuranceEmployeePremium,
        '賞与_厚生年金保険料_会社': premium.bonusPensionInsuranceEmployerPremium,
        '賞与_介護保険料_本人': premium.bonusCareInsuranceEmployeePremium,
        '賞与_介護保険料_会社': premium.bonusCareInsuranceEmployerPremium,
        賞与_本人負担合計: premium.bonusEmployeePremiumTotal,
        賞与_会社負担合計: premium.bonusEmployerPremiumTotal,
        本人負担合計: premium.totalEmployeePremium,
        会社負担合計: premium.totalEmployerPremium,
    };
}

export type InsurancePremiumCsvExportResult =
    | { ok: true; csvText: string; fileName: string }
    | { ok: false; error: string };

export function buildInsurancePremiumCsvExport(params: {
    items: InsurancePremiumCsvExportItem[];
    collectionTiming: InsurancePremiumCollectionTiming;
    payYearMonth: string;
}): InsurancePremiumCsvExportResult {
    if (params.items.length === 0) {
        return { ok: false, error: 'CSV出力できる保険料計算結果がありません' };
    }

    const rows = params.items.map((item) =>
        createInsurancePremiumCsvRow(item, params.collectionTiming),
    );
    const csvText = convertRowsToCsv(rows);
    const fileName = `保険料計算結果_${params.payYearMonth}.csv`;

    return { ok: true, csvText, fileName };
}

export function exportInsurancePremiumCsv(params: {
    items: InsurancePremiumCsvExportItem[];
    collectionTiming: InsurancePremiumCollectionTiming;
    payYearMonth: string;
}): InsurancePremiumCsvExportResult {
    const result = buildInsurancePremiumCsvExport(params);
    if (!result.ok) return result;
    downloadCsv(result.csvText, result.fileName);
    return result;
}
