import {
    buildSocialInsuranceJoinJudgmentContext,
    judgeSocialInsuranceEmploymentStatus,
    resolveHealthInsuranceJoinStatus,
    resolvePartTimeJoinRoute,
    resolvePensionInsuranceJoinStatus,
    resolveRegularDeterminationMinPaymentBaseDays,
} from './social-insurance-join-status.util';
import { SHORT_TIME_WORKER_REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS } from '../../insurance/utils/standard-remuneration-determination.util';

describe('social-insurance-join-status.util', () => {
    const employee = {
        employmentType: 'full-time' as const,
        birthDate: '1995-01-01',
    };

    it('正社員で未保存の加入状況は雇用区分から active と判定する', () => {
        const ctx = buildSocialInsuranceJoinJudgmentContext(employee as never, null, null);
        expect(judgeSocialInsuranceEmploymentStatus(ctx!)).toBe('active');
        expect(resolveHealthInsuranceJoinStatus('unknown', ctx)).toBe('active');
        expect(resolvePensionInsuranceJoinStatus('unknown', ctx)).toBe('active');
    });

    it('Firestore に inactive が保存されている場合はそれを優先する', () => {
        const ctx = buildSocialInsuranceJoinJudgmentContext(employee as never, null, null);
        expect(resolveHealthInsuranceJoinStatus('inactive', ctx)).toBe('inactive');
    });

    it('短時間労働者として加入したパートは算定基礎の支払基礎日数下限が11日', () => {
        const partTimeEmployee = {
            employmentType: 'part-time' as const,
            birthDate: '1995-01-01',
        };
        const status = {
            weeklyScheduledWorkHours: 20,
            monthlyScheduledWorkDays: 12,
            prescribedWage: 90000,
            isStudent: false,
            expectedEmploymentOver2Months: true,
        };
        const office = {
            regularWeeklyScheduledWorkHours: 40,
            regularMonthlyScheduledWorkDays: 20,
        };
        const ctx = buildSocialInsuranceJoinJudgmentContext(
            partTimeEmployee as never,
            status as never,
            office as never,
        );
        expect(resolvePartTimeJoinRoute(ctx!)).toBe('short_time_worker');
        expect(resolveRegularDeterminationMinPaymentBaseDays(ctx)).toBe(
            SHORT_TIME_WORKER_REGULAR_DETERMINATION_MIN_PAYMENT_BASE_DAYS,
        );
    });

    it('4分の3基準のパートは算定基礎の支払基礎日数下限が17日', () => {
        const partTimeEmployee = {
            employmentType: 'part-time' as const,
            birthDate: '1995-01-01',
        };
        const status = {
            weeklyScheduledWorkHours: 30,
            monthlyScheduledWorkDays: 15,
            prescribedWage: 120000,
            isStudent: false,
            expectedEmploymentOver2Months: true,
        };
        const office = {
            regularWeeklyScheduledWorkHours: 40,
            regularMonthlyScheduledWorkDays: 20,
        };
        const ctx = buildSocialInsuranceJoinJudgmentContext(
            partTimeEmployee as never,
            status as never,
            office as never,
        );
        expect(resolvePartTimeJoinRoute(ctx!)).toBe('three_quarters');
        expect(resolveRegularDeterminationMinPaymentBaseDays(ctx)).toBe(17);
    });
});
