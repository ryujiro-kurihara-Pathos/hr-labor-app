import { Company } from '../../company/models/company.model';
import { Office } from '../../company/models/office.model';
import { createEmptyEmployeeInput, Employee } from '../../employee/models/employee.models';
import {
    validateBonusPaymentProcedureSubmit,
    validateDependentProcedureSubmit,
    validateLossProcedureSubmit,
    validateQualificationProcedureSubmit,
    validateRegularDecisionProcedureSubmit,
    validateRevisionProcedureSubmit,
} from './procedure-submit-validation.util';

const company = {
    id: 'c1',
    name: 'テスト株式会社',
    representativeName: '代表太郎',
    address: '',
    createdBy: 'u1',
    payrollClosingDay: null,
    payrollPaymentDay: 25,
    payrollPaymentMonthOffset: 1 as const,
    insurancePremiumCollectionTiming: 'next_month' as const,
    createdAt: {} as Company['createdAt'],
    updatedAt: {} as Company['updatedAt'],
} satisfies Company;

const office = {
    id: 'o1',
    companyId: 'c1',
    name: '本社',
    officeSymbol: '1234-5678',
    officeNumber: '1234567',
    prefecture: '東京都',
    city: '千代田区',
    streetAddress: '1-1',
    buildingName: '',
    postalCode: '100-0001',
    phoneNumber: '03-1234-5678',
    healthInsuranceType: 'kyokai' as const,
    regularWeeklyScheduledWorkHours: null,
    regularMonthlyScheduledWorkHours: null,
    regularWeeklyScheduledWorkDays: null,
    regularMonthlyScheduledWorkDays: null,
    status: 'active' as const,
    createdAt: {} as Office['createdAt'],
    updatedAt: {} as Office['updatedAt'],
} satisfies Office;

const employee = {
    id: 'e1',
    ...createEmptyEmployeeInput({
        companyId: 'c1',
        officeId: 'o1',
        lastName: '山田',
        firstName: '太郎',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'タロウ',
        birthDate: '1990-01-01',
        gender: 'male',
        prefecture: '東京都',
        city: '千代田区',
        streetAddress: '2-2',
        myNumber: '123456789012',
        insuredPersonNumber: '1',
        joinedDate: '2026-04-01',
        employmentType: 'full-time',
    }),
    createdAt: {} as Employee['createdAt'],
    updatedAt: {} as Employee['updatedAt'],
} satisfies Employee;

describe('procedure-submit-validation.util', () => {
    describe('validateQualificationProcedureSubmit', () => {
        it('passes when required fields are present', () => {
            expect(
                validateQualificationProcedureSubmit({
                    employee,
                    office,
                    company,
                    qualificationDate: '2026-04-01',
                    monthlyReward: {
                        targetYearMonth: '2026-04',
                        cashAmount: 300000,
                        inKindAmount: 0,
                        totalAmount: 300000,
                        isMidMonthJoin: false,
                        usesDirectMonthlyRewardEntry: false,
                    },
                }),
            ).toEqual({ ok: true });
        });

        it('fails when monthly reward is missing', () => {
            const result = validateQualificationProcedureSubmit({
                employee,
                office,
                company,
                qualificationDate: '2026-04-01',
                monthlyReward: null,
            });
            expect(result.ok).toBeFalse();
            if (!result.ok) {
                expect(result.message).toBe('未入力の項目があります');
                expect(result.missingFields?.[0]?.label).toContain('報酬月額');
            }
        });
    });

    describe('validateLossProcedureSubmit', () => {
        it('fails when loss reason is missing', () => {
            const result = validateLossProcedureSubmit({
                employee,
                office,
                company,
                lossDate: '2026-05-01',
                lossReason: null,
            });
            expect(result.ok).toBeFalse();
        });

        it('passes when loss date and reason are present', () => {
            expect(
                validateLossProcedureSubmit({
                    employee,
                    office,
                    company,
                    lossDate: '2026-05-01',
                    lossReason: 'retirement',
                }),
            ).toEqual({ ok: true });
        });
    });

    describe('validateDependentProcedureSubmit', () => {
        it('requires add reason for add change', () => {
            const result = validateDependentProcedureSubmit('add', {
                changeDate: '',
                dependentId: '',
                lastName: '山田',
                firstName: '花子',
                birthDate: '2020-01-01',
                gender: 'female',
                relationship: 'child',
                dependencyStartDate: '2026-04-01',
                addReason: '',
                addReasonNote: '',
                dependencyEndDate: '',
                deleteReason: '',
            });
            expect(result.ok).toBeFalse();
        });

        it('requires change date for change type', () => {
            const result = validateDependentProcedureSubmit('change', {
                changeDate: '',
                dependentId: 'd1',
                lastName: '山田',
                firstName: '花子',
                birthDate: '2020-01-01',
                gender: 'female',
                relationship: 'child',
                dependencyStartDate: '',
                addReason: '',
                addReasonNote: '',
                dependencyEndDate: '',
                deleteReason: '',
            });
            expect(result.ok).toBeFalse();
            if (!result.ok) {
                expect(result.missingFields?.some((field) => field.label.includes('変更した日'))).toBeTrue();
            }
        });

        it('requires note when add reason is other', () => {
            const result = validateDependentProcedureSubmit('add', {
                changeDate: '',
                dependentId: '',
                lastName: '山田',
                firstName: '花子',
                birthDate: '2020-01-01',
                gender: 'female',
                relationship: 'child',
                dependencyStartDate: '2026-04-01',
                addReason: 'other',
                addReasonNote: '',
                dependencyEndDate: '',
                deleteReason: '',
            });
            expect(result.ok).toBeFalse();
            if (!result.ok) {
                expect(result.missingFields?.some((field) => field.label === '記載')).toBeTrue();
            }
        });
    });

    describe('validateRegularDecisionProcedureSubmit', () => {
        it('fails when reward months are missing', () => {
            const result = validateRegularDecisionProcedureSubmit({
                employee,
                office,
                company,
                missingMonthlyRewardMonths: ['2026-04'],
                averageMonthlyReward: null,
                standardRemuneration: null,
            });
            expect(result.ok).toBeFalse();
            if (!result.ok) {
                expect(result.message).toBe('未入力の項目があります');
                expect(result.missingFields?.[0]?.label).toContain('4月');
            }
        });
    });

    describe('validateRevisionProcedureSubmit', () => {
        it('fails for ineligible revision reason', () => {
            const result = validateRevisionProcedureSubmit({
                employee,
                office,
                company,
                targetYearMonth: '2026-07',
                revisionRevisedMonthlyReward: 320000,
                revisionReason: '等級差が2未満のため随時改定の対象外',
            });
            expect(result.ok).toBeFalse();
        });
    });

    describe('validateBonusPaymentProcedureSubmit', () => {
        it('fails when bonus amount is missing', () => {
            const result = validateBonusPaymentProcedureSubmit({
                employee,
                office,
                company,
                targetYearMonth: '2026-06',
                bonusAmount: null,
            });
            expect(result.ok).toBeFalse();
        });
    });
});
