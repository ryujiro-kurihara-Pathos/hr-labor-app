import { SocialInsuranceStatus } from '../models/social-insurance-status.model';
import {
    insuranceJoinStatusListLabel,
    isInsuranceEnrolled,
} from './social-insurance-status-display.util';

describe('social-insurance-status-display.util', () => {
    const enrolledStatus = {
        healthInsuranceStartDate: '2026-04-01',
        pensionInsuranceStartDate: '2026-04-01',
        careInsuranceStartDate: '2026-04-01',
    } as SocialInsuranceStatus;

    it('does not show enrolled before qualification procedure is completed', () => {
        expect(
            isInsuranceEnrolled('active', 'health', enrolledStatus, false),
        ).toBe(false);
        expect(
            insuranceJoinStatusListLabel('active', 'health', enrolledStatus, false),
        ).toBe('対象');
    });

    it('shows enrolled only when procedure is completed and start date exists', () => {
        expect(
            isInsuranceEnrolled('active', 'health', enrolledStatus, true),
        ).toBe(true);
        expect(
            insuranceJoinStatusListLabel('active', 'health', enrolledStatus, true),
        ).toBe('加入中');
    });

    it('does not show enrolled when start date is missing even if procedure completed', () => {
        const withoutDates = {
            healthInsuranceStartDate: null,
            pensionInsuranceStartDate: null,
            careInsuranceStartDate: null,
        } as SocialInsuranceStatus;

        expect(
            isInsuranceEnrolled('active', 'health', withoutDates, true),
        ).toBe(false);
    });

    it('does not show enrolled when join status is not active', () => {
        expect(
            isInsuranceEnrolled('unknown', 'health', enrolledStatus, true),
        ).toBe(false);
    });
});
