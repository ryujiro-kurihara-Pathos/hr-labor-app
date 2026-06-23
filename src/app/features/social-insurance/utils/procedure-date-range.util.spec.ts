import { Timestamp } from 'firebase/firestore';

import { Employee } from '../../employee/models/employee.models';
import {
    resolveBonusPaymentDateBounds,
    resolveDependencyStartDateBounds,
    resolveInsuredPeriodBounds,
    validateDateWithinInsuredPeriod,
    validateDependentBirthDate,
    validateDependentOccurredDate,
    validateLossDateRange,
    validateQualificationDateRange,
} from './procedure-date-range.util';

const employee = {
    id: 'emp-1',
    joinedDate: '2026-04-01',
    retiredDate: null,
} as Employee;

describe('procedure-date-range.util', () => {
    it('validates qualification date within join and retirement', () => {
        expect(validateQualificationDateRange('2026-04-01', employee)).toBeNull();
        expect(validateQualificationDateRange('2026-03-31', employee)).toContain('入社日');
    });

    it('validates loss date after qualification date', () => {
        expect(validateLossDateRange('2026-04-16', '2026-04-01')).toBeNull();
        expect(validateLossDateRange('2026-04-01', '2026-04-01')).toContain('資格取得日');
    });

    it('validates dates within insured period', () => {
        const bounds = resolveInsuredPeriodBounds({
            employee,
            healthInsuranceStartDate: '2026-04-01',
            healthInsuranceEndDate: '2026-06-01',
        });
        expect(validateDateWithinInsuredPeriod('2026-05-01', bounds)).toBeNull();
        expect(validateDateWithinInsuredPeriod('2026-03-31', bounds)).toContain('資格取得日');
        expect(validateDateWithinInsuredPeriod('2026-06-01', bounds)).toContain('資格喪失日');
    });

    it('validates dependent occurred date within coverage period', () => {
        const bounds = resolveInsuredPeriodBounds({
            employee,
            healthInsuranceStartDate: '2026-04-01',
        });
        expect(
            validateDependentOccurredDate({
                occurredDate: '2026-05-01',
                changeType: 'delete',
                bounds,
                dependencyStartDate: '2026-04-10',
                dependencyEndDate: '2026-05-10',
            }),
        ).toBeNull();
        expect(
            validateDependentOccurredDate({
                occurredDate: '2026-04-05',
                changeType: 'delete',
                bounds,
                dependencyStartDate: '2026-04-10',
            }),
        ).toContain('被扶養者になった日');
    });

    it('rejects future birth date', () => {
        expect(
            validateDependentBirthDate({
                birthDate: '2030-01-01',
                referenceDate: '2026-06-01',
            }),
        ).toContain('未来');
    });

    it('rejects birth date after dependency start date', () => {
        expect(
            validateDependentBirthDate({
                birthDate: '2020-06-01',
                referenceDate: '2026-06-01',
                eventDate: '2020-01-01',
            }),
        ).toContain('以前');
    });

    it('rejects dependency start date before join date for add', () => {
        const bounds = resolveInsuredPeriodBounds({
            employee,
            healthInsuranceStartDate: '2026-04-01',
        });
        expect(
            validateDependentOccurredDate({
                occurredDate: '2026-03-31',
                changeType: 'add',
                bounds,
                employee,
                referenceDate: '2026-06-01',
                birthDate: '2020-01-01',
            }),
        ).toContain('入社日');
    });

    it('rejects dependency start date on or before birth date for add', () => {
        const bounds = resolveInsuredPeriodBounds({
            employee,
            healthInsuranceStartDate: '2026-04-01',
        });
        expect(
            validateDependentOccurredDate({
                occurredDate: '2020-01-01',
                changeType: 'add',
                bounds,
                employee,
                referenceDate: '2026-06-01',
                birthDate: '2020-01-01',
            }),
        ).toContain('生年月日');
        expect(
            validateDependentOccurredDate({
                occurredDate: '2020-06-01',
                changeType: 'add',
                bounds,
                employee,
                referenceDate: '2026-06-01',
                birthDate: '2020-06-01',
            }),
        ).toContain('生年月日');
    });

    it('rejects future dependency start date for add', () => {
        const bounds = resolveInsuredPeriodBounds({
            employee,
            healthInsuranceStartDate: '2026-04-01',
        });
        expect(
            validateDependentOccurredDate({
                occurredDate: '2026-07-01',
                changeType: 'add',
                bounds,
                employee,
                referenceDate: '2026-06-01',
                birthDate: '2020-01-01',
            }),
        ).toContain('被扶養者になった日');
    });

    it('resolves dependency start date bounds from join date and birth date', () => {
        const bounds = resolveInsuredPeriodBounds({
            employee,
            healthInsuranceStartDate: '2026-04-01',
        });
        expect(
            resolveDependencyStartDateBounds({
                bounds,
                employee,
                birthDate: '2020-01-01',
                referenceDate: '2026-06-01',
            }),
        ).toEqual({
            min: '2026-04-01',
            max: '2026-06-01',
        });
    });

    it('rejects future dependency occurred date for change', () => {
        const bounds = resolveInsuredPeriodBounds({
            employee,
            healthInsuranceStartDate: '2026-04-01',
        });
        expect(
            validateDependentOccurredDate({
                occurredDate: '2026-07-01',
                changeType: 'change',
                bounds,
                employee,
                referenceDate: '2026-06-01',
                dependencyStartDate: '2026-04-10',
            }),
        ).toContain('異動日');
    });

    it('allows bonus payment through month end in month after retirement', () => {
        const retired = {
            ...employee,
            retiredDate: Timestamp.fromDate(new Date(2026, 5, 30)),
        } as Employee;
        const bounds = resolveBonusPaymentDateBounds({
            employee: retired,
            targetYearMonth: '2026-07',
            healthInsuranceStartDate: '2026-04-01',
            monthEndDate: '2026-07-31',
        });

        expect(bounds.max).toBe('2026-07-31');
    });
});
