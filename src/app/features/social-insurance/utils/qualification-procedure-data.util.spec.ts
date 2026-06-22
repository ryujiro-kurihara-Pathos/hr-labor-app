import {
    buildQualificationProcedureRewardPreviewPatch,
    canAutoManageQualificationProcedure,
    hasJoinDateChanged,
    isQualificationDateDerivedFromJoinDate,
    isQualificationProcedureRewardPreviewUnchanged,
    qualificationProcedureDueDate,
    resolveEffectiveHealthInsuranceStartDateForSync,
    resolveLiveQualificationDisplayDate,
    resolvePreviewQualificationDate,
    resolveQualificationDateAfterJoinDateChange,
    resolveQualificationProcedureDates,
    shouldSyncQualificationProcedureDates,
    shouldUpdateInsuranceStartDatesFromJoinDate,
} from './qualification-procedure-data.util';
import { Employee } from '../../employee/models/employee.models';
import { Procedure } from '../models/procedures.model';

describe('qualification-procedure-data.util sync helpers', () => {
    const employee = {
        id: 'e1',
        companyId: 'c1',
        officeId: 'o1',
        joinedDate: '2026-04-01',
    } as Employee;

    const procedure = {
        qualificationDate: '2026-04-01',
        occurredDate: '2026-04-01',
        dueDate: qualificationProcedureDueDate('2026-04-01'),
        status: 'notStarted',
    } as Procedure;

    it('resolves dates from joined date when health insurance start date is unset', () => {
        expect(resolveQualificationProcedureDates(employee, null)).toEqual({
            qualificationDate: '2026-04-01',
            occurredDate: '2026-04-01',
            dueDate: qualificationProcedureDueDate('2026-04-01'),
        });
    });

    it('prefers registered health insurance start date', () => {
        expect(resolveQualificationProcedureDates(employee, '2026-04-15')).toEqual({
            qualificationDate: '2026-04-15',
            occurredDate: '2026-04-15',
            dueDate: qualificationProcedureDueDate('2026-04-15'),
        });
    });

    it('detects join date changes', () => {
        expect(hasJoinDateChanged('2026-04-01', '2026-04-10')).toBe(true);
        expect(hasJoinDateChanged('', '2026-04-01')).toBe(true);
        expect(hasJoinDateChanged('2026-04-01', '2026-04-01')).toBe(false);
    });

    it('allows auto manage unless both insurances are inactive', () => {
        expect(canAutoManageQualificationProcedure('unknown', 'unknown')).toBe(true);
        expect(canAutoManageQualificationProcedure('active', 'active')).toBe(true);
        expect(canAutoManageQualificationProcedure('inactive', 'active')).toBe(false);
    });

    it('syncs incomplete procedures when join date is set or changed', () => {
        expect(
            shouldSyncQualificationProcedureDates('notStarted', null, {
                previousJoinedDate: '',
                newJoinedDate: '2026-04-01',
                procedure,
            }),
        ).toBe(true);
        expect(
            shouldSyncQualificationProcedureDates('inProgress', '2026-04-15', {
                previousJoinedDate: '2026-04-01',
                newJoinedDate: '2026-04-10',
                procedure,
            }),
        ).toBe(true);
    });

    it('does not sync completed procedures or unchanged join dates without stale data', () => {
        expect(
            shouldSyncQualificationProcedureDates('completed', '2026-04-01', {
                previousJoinedDate: '2026-04-01',
                newJoinedDate: '2026-04-10',
                procedure,
                employee,
            }),
        ).toBe(false);
        expect(
            shouldSyncQualificationProcedureDates('inProgress', '2026-04-01', {
                previousJoinedDate: '2026-04-01',
                newJoinedDate: '2026-04-01',
                procedure,
                employee,
            }),
        ).toBe(false);
    });

    it('syncs when stored procedure dates are stale for the current join date', () => {
        expect(
            shouldSyncQualificationProcedureDates('inProgress', null, {
                previousJoinedDate: '2026-04-01',
                newJoinedDate: '2026-04-01',
                procedure: {
                    qualificationDate: '2026-04-01',
                    occurredDate: '2026-04-01',
                    dueDate: qualificationProcedureDueDate('2026-04-01'),
                },
                employee: { ...employee, joinedDate: '2026-04-10' },
            }),
        ).toBe(true);
    });

    it('previews qualification date from join date before procedure completion', () => {
        expect(
            resolvePreviewQualificationDate(employee, {
                joinedDate: '2026-04-10',
                procedure: { ...procedure, status: 'notStarted' },
            }),
        ).toBe('2026-04-10');
        expect(
            resolvePreviewQualificationDate(employee, {
                joinedDate: '2026-04-10',
                healthInsuranceStartDate: '2026-04-01',
                procedure: { ...procedure, status: 'completed' },
            }),
        ).toBe('2026-04-01');
    });

    it('uses join date for sync when start date matches previous join date', () => {
        expect(
            resolveEffectiveHealthInsuranceStartDateForSync(
                employee,
                '2026-04-01',
                '2026-04-01',
                procedure,
            ),
        ).toBeNull();
        expect(
            resolveQualificationProcedureDates(
                { ...employee, joinedDate: '2026-04-10' },
                resolveEffectiveHealthInsuranceStartDateForSync(
                    { ...employee, joinedDate: '2026-04-10' },
                    '2026-04-01',
                    '2026-04-01',
                    { ...procedure, status: 'inProgress' },
                ),
            ),
        ).toEqual({
            qualificationDate: '2026-04-10',
            occurredDate: '2026-04-10',
            dueDate: qualificationProcedureDueDate('2026-04-10'),
        });
    });

    it('shows join date on live display for incomplete procedures', () => {
        expect(
            resolveLiveQualificationDisplayDate(
                { ...employee, joinedDate: '2026-04-10' },
                '2026-04-01',
                { ...procedure, status: 'inProgress' },
            ),
        ).toBe('2026-04-10');
    });

    it('keeps saved qualification date on live display for completed procedures', () => {
        expect(
            resolveLiveQualificationDisplayDate(
                { ...employee, joinedDate: '2026-04-10' },
                '2026-04-01',
                { ...procedure, status: 'completed' },
            ),
        ).toBe('2026-04-01');
    });

    it('updates insurance start dates when join date changes', () => {
        expect(
            shouldUpdateInsuranceStartDatesFromJoinDate(
                '2026-04-01',
                '2026-04-10',
                null,
                null,
                { status: 'notStarted' },
            ),
        ).toBe(true);
        expect(
            shouldUpdateInsuranceStartDatesFromJoinDate(
                '2026-04-01',
                '2026-04-10',
                null,
                null,
                { status: 'completed' },
            ),
        ).toBe(false);
    });

    it('resolves qualification date after join date change for persistence', () => {
        expect(
            resolveQualificationDateAfterJoinDateChange(
                { ...employee, joinedDate: '2026-04-10' },
                '2026-04-01',
                { status: 'notStarted' },
            ),
        ).toBe('2026-04-10');
        expect(
            resolveQualificationDateAfterJoinDateChange(
                { ...employee, joinedDate: '2026-04-10' },
                '2026-04-01',
                { status: 'completed' },
            ),
        ).toBeNull();
    });

    it('detects join-derived qualification dates', () => {
        expect(
            isQualificationDateDerivedFromJoinDate('2026-04-01', '2026-04-01', procedure),
        ).toBe(true);
        expect(
            isQualificationDateDerivedFromJoinDate('2026-04-15', '2026-04-01', procedure),
        ).toBe(false);
    });

    it('builds reward preview patch from monthly reward', () => {
        expect(
            buildQualificationProcedureRewardPreviewPatch({
                targetYearMonth: '2026-04',
                cashAmount: 300000,
                inKindAmount: 0,
                totalAmount: 300000,
                isMidMonthJoin: false,
                usesDirectMonthlyRewardEntry: false,
            }),
        ).toEqual({
            rewardTargetYearMonth: '2026-04',
            rewardCashAmount: 300000,
            rewardInKindAmount: 0,
            rewardTotalAmount: 300000,
            rewardIsMidMonthJoin: false,
        });
    });

    it('detects unchanged reward preview patch', () => {
        const patch = buildQualificationProcedureRewardPreviewPatch({
            targetYearMonth: '2026-04',
            cashAmount: 300000,
            inKindAmount: 0,
            totalAmount: 300000,
            isMidMonthJoin: false,
            usesDirectMonthlyRewardEntry: false,
        });
        expect(
            isQualificationProcedureRewardPreviewUnchanged(
                {
                    ...procedure,
                    rewardTargetYearMonth: '2026-04',
                    rewardCashAmount: 300000,
                    rewardInKindAmount: 0,
                    rewardTotalAmount: 300000,
                    rewardIsMidMonthJoin: false,
                },
                patch,
            ),
        ).toBe(true);
    });
});
