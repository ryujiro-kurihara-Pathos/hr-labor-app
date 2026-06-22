import { Employee } from '../../employee/models/employee.models';
import { CalculatedInsurancePremium } from '../services/insurance-premium-calculation.service';
import {
    buildInsurancePremiumCsvExport,
    createInsurancePremiumCsvRow,
} from './insurance-premium-csv-export.util';

const baseEmployee = {
    id: 'emp-1',
    companyId: 'company-1',
    officeId: 'office-1',
    employeeNumber: 'E001',
    insuredPersonNumber: '1',
    lastName: '山田',
    firstName: '太郎',
    lastNameKana: 'ヤマダ',
    firstNameKana: 'タロウ',
    birthDate: '1990-01-01',
    gender: 'male',
    postalCode: '1000001',
    prefecture: '東京都',
    city: '千代田区',
    streetAddress: '1-1',
    buildingName: '',
    phoneNumber: '0300000000',
    email: 'taro@example.com',
    myNumber: '',
    joinedDate: '2024-04-01',
    employmentType: 'full-time',
    department: '',
    position: '',
    status: 'active',
    retiredDate: null,
    createdAt: {} as never,
    updatedAt: {} as never,
} as Employee;

const basePremium: CalculatedInsurancePremium = {
    standardMonthlyAmount: 300000,
    pensionStandardMonthlyAmount: 300000,
    healthInsuranceEmployeePremium: 15000,
    healthInsuranceEmployerPremium: 15000,
    pensionInsuranceEmployeePremium: 27450,
    pensionInsuranceEmployerPremium: 27450,
    careInsuranceEmployeePremium: 0,
    careInsuranceEmployerPremium: 0,
    monthlyEmployeePremiumTotal: 42450,
    monthlyEmployerPremiumTotal: 42450,
    bonusHealthInsuranceEmployeePremium: 5000,
    bonusHealthInsuranceEmployerPremium: 5000,
    bonusPensionInsuranceEmployeePremium: 9150,
    bonusPensionInsuranceEmployerPremium: 9150,
    bonusCareInsuranceEmployeePremium: 0,
    bonusCareInsuranceEmployerPremium: 0,
    bonusEmployeePremiumTotal: 14150,
    bonusEmployerPremiumTotal: 14150,
    totalEmployeePremium: 56600,
    totalEmployerPremium: 56600,
};

describe('insurance-premium-csv-export.util', () => {
    it('creates a row with monthly and bonus breakdown', () => {
        const row = createInsurancePremiumCsvRow(
            {
                employee: baseEmployee,
                officeName: '本社',
                payYearMonth: '2025-05',
                premium: basePremium,
            },
            'next_month',
        );

        expect(row.給与控除月).toBe('2025-05');
        expect(row.保険料対象月).toBe('2025-04');
        expect(row.氏名).toBe('山田 太郎');
        expect(row.標準報酬月額_健康保険).toBe(300000);
        expect(row.標準報酬月額_厚生年金).toBe(300000);
        expect(row['月次報酬_健康保険料_本人']).toBe(15000);
        expect(row['賞与_厚生年金保険料_会社']).toBe(9150);
        expect(row.本人負担合計).toBe(56600);
    });

    it('builds csv export with header row', () => {
        const result = buildInsurancePremiumCsvExport({
            items: [
                {
                    employee: baseEmployee,
                    officeName: '本社',
                    payYearMonth: '2025-05',
                    premium: basePremium,
                },
            ],
            collectionTiming: 'same_month',
            payYearMonth: '2025-05',
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.fileName).toBe('保険料計算結果_2025-05.csv');
        expect(result.csvText).toContain('給与控除月');
        expect(result.csvText).toContain('月次報酬_健康保険料_本人');
        expect(result.csvText).toContain('賞与_介護保険料_会社');
        expect(result.csvText).toContain('山田 太郎');
    });

    it('returns error when no exportable rows', () => {
        const result = buildInsurancePremiumCsvExport({
            items: [],
            collectionTiming: 'same_month',
            payYearMonth: '2025-05',
        });

        expect(result).toEqual({ ok: false, error: 'CSV出力できる保険料計算結果がありません' });
    });
});
