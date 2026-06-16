import {
    buildSocialInsuranceJoinJudgmentContext,
    judgeSocialInsuranceEmploymentStatus,
    resolveHealthInsuranceJoinStatus,
    resolvePensionInsuranceJoinStatus,
} from './social-insurance-join-status.util';

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
});
