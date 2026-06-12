import {
    canJudgePartTimeInsurance,
    getMissingPartTimeJudgmentFields,
    needsPartTimeInsuranceJudgmentWarning,
} from './part-time-insurance-judgment.util';

describe('part-time-insurance-judgment.util', () => {
    it('detects missing numeric labor condition fields', () => {
        expect(
            getMissingPartTimeJudgmentFields({
                weeklyScheduledWorkHours: null,
                monthlyScheduledWorkDays: 20,
                prescribedWage: 88000,
            }),
        ).toEqual(['weeklyScheduledWorkHours']);
    });

    it('allows judgment when required numeric fields are set', () => {
        expect(
            canJudgePartTimeInsurance({
                weeklyScheduledWorkHours: 20,
                monthlyScheduledWorkDays: 11,
                prescribedWage: 88000,
            }),
        ).toBeTrue();
    });

    it('shows warning only for part-time employees with missing fields', () => {
        expect(
            needsPartTimeInsuranceJudgmentWarning('full-time', {
                employeeId: 'e1',
                weeklyScheduledWorkHours: null,
                monthlyScheduledWorkDays: null,
                prescribedWage: null,
                isStudent: false,
                expectedEmploymentOver2Months: false,
                healthInsuranceStatus: 'unknown',
                pensionInsuranceStatus: 'unknown',
                careInsuranceStatus: 'inactive',
                healthInsuranceStartDate: null,
                healthInsuranceEndDate: null,
                pensionInsuranceStartDate: null,
                pensionInsuranceEndDate: null,
                careInsuranceStartDate: null,
                careInsuranceEndDate: null,
                memo: '',
                id: 's1',
                createdAt: {} as never,
                updatedAt: {} as never,
            }),
        ).toBeFalse();

        expect(needsPartTimeInsuranceJudgmentWarning('part-time', null)).toBeTrue();
    });
});
