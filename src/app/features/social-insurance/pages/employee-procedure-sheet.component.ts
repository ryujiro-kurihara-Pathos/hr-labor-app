import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { Procedure } from '../models/procedures.model';
import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';
import { ProcedureActionBarComponent } from '../components/procedure-action-bar.component';
import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { splitOfficeSymbol } from '../../company/utils/office-format.util';
import {
    dateLabel,
    genderLabel,
    procedureStatusLabel,
} from '../utils/procedure-display.util';
import { StandardMonthlyRewardService } from '../../insurance/services/standard-monthly-reward.service';
import {
    getAprJunYearMonths,
    getFirstRegularDeterminationYearMonth,
    getPaymentBaseDays,
    getQualificationDate,
    getRegularBaseMonths,
    getRegularCalculationMonths,
    getRegularDecisionProcedureBaseYear,
} from '../../insurance/utils/standard-remuneration-determination.util';
import { StandardMonthlyRewardCalculatorService } from '../../insurance/services/standard-monthly-reward-calculator.service';
import { StandardRemunerationDeterminationService } from '../../insurance/services/standard-remuneration-determination.service';
import { RouterLink } from '@angular/router';
import { addMonthsToYearMonth, yearMonthFromDateString } from '../../insurance/utils/reward-target-month.util';
import { effectiveMonthlyRewardTotal } from '../../insurance/utils/effective-monthly-reward.util';
import {
    evaluateRevisionAtOrigin,
    pickWinningDeterminationCandidate,
} from '../../insurance/utils/determination-precedence.util';
import { calculateRevisionAverageMonthlyReward } from '../../insurance/utils/revision-determination.util';
import {
    FIXED_WAGE_FIELD_LABELS,
    FixedWageFieldKey,
} from '../../insurance/utils/fixed-wage-change.util';
import { formatYen } from '../utils/qualification-reward.util';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { SocialInsuranceStatusService } from '../services/social-insurance-status.service';
import { StandardMonthlyReward } from '../../insurance/models/standard-monthly-reward.model';
import { BonusReward } from '../../bonus/models/bonus-reward.model';

type StandardRemunerationAmounts = {
    health: number;
    pension: number;
};

export type RegularDecisionMonthBreakdown = {
    yearMonth: string;
    paymentBaseDays: number | null;
    cashAmount: number | null;
    inKindAmount: number | null;
    totalAmount: number | null;
};

export type RemunerationProcedureVariant = 'regularDecision' | 'revision' | 'bonusPayment';

@Component({
    selector: 'app-employee-procedure-sheet',
    standalone: true,
    imports: [ProcedureActionBarComponent, RouterLink, DecimalPipe],
    templateUrl: './employee-procedure-sheet.component.html',
})

export class EmployeeProcedureSheetComponent {
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly calculator = inject(StandardMonthlyRewardCalculatorService);
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly bonusRewardService = inject(BonusRewardService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly procedureService = inject(SocialInsuranceProcedureService);

    procedure = input.required<Procedure>();
    employee = input.required<Employee>();
    office = input.required<Office>();
    company = input.required<Company>();
    formTitle = input.required<string>();
    variant = input.required<RemunerationProcedureVariant>();

    procedureUpdated = output<Procedure>();

    isSubmitting = signal(false);
    submitErrorMessage = signal('');

    // 算定基礎
    /** 算定基礎届の4〜6月で報酬未入力の年月（例: ['2026-04', '2026-05']） */
    missingMonthlyRewardMonths = signal<string[]>([]);

    /** 4〜6月の報酬月額の平均（算定対象月のみ） */
    averageMonthlyReward = signal<number | null>(null);

    /** 4〜6月の報酬月額の総計（算定対象月のみ） */
    rewardTotalSum = signal<number | null>(null);

    /** 平均報酬月額から算出した標準報酬月額（健康保険・厚生年金） */
    standardRemuneration = signal<StandardRemunerationAmounts | null>(null);

    /** 従前の標準報酬月額（健康保険） */
    previousStandardRemuneration = signal<number | null>(null);

    /** 従前改定月（YYYY-MM） */
    previousRevisionMonth = signal<string | null>(null);

    /** 4〜6月の月別内訳 */
    regularDecisionMonths = signal<RegularDecisionMonthBreakdown[]>([]);

    // 月額変更
    /** 月額変更届：改定前の報酬月額（変更月の前月） */
    revisionPreviousMonthlyReward = signal<number | null>(null);

    /** 月額変更届：改定後の報酬月額（算定3か月の平均） */
    revisionRevisedMonthlyReward = signal<number | null>(null);

    /** 月額変更届：改定理由 */
    revisionReason = signal<string | null>(null);

    // 賞与支払
    // 賞与額
    bonusPaymentAmount = signal<number | null>(null);
    // 賞与額の取得
    async loadBonusPaymentAmount(): Promise<void> {
        this.bonusPaymentAmount.set(null);

        const employee = this.employee();
        if (!employee) return;

        const targetYearMonth = this.procedure().targetYearMonth;
        if (!targetYearMonth) return;

        try {
            const bonuses = await this.bonusRewardService.getBonusRewardsByEmployee(employee.companyId, employee.id);
            this.bonusPaymentAmount.set(bonuses[0].bonusAmount);
        } catch (error) {
            console.error('賞与額の取得に失敗しました', error);
        }
    }

    applicationYearMonth = computed(() => {
        const targetYearMonth = this.procedure().targetYearMonth;
        if (!targetYearMonth || this.variant() !== 'regularDecision') return null;
        return addMonthsToYearMonth(targetYearMonth, 3);
    });

    constructor() {
        effect(() => {
            const variant = this.variant();
            const procedure = this.procedure();
            const employee = this.employee();

            if (!employee || !procedure.targetYearMonth) {
                this.resetRegularDecisionSignals();
                this.resetRevisionSignals();
                return;
            }

            if (variant === 'regularDecision') {
                this.resetRevisionSignals();
                void this.loadRegularDecisionData(procedure, employee);
                return;
            }

            if (variant === 'revision') {
                this.resetRegularDecisionSignals();
                void this.loadRevisionData(procedure, employee);
                return;
            }

            if (variant === 'bonusPayment') {
                this.resetRegularDecisionSignals();
                this.resetRevisionSignals();
                void this.loadBonusPaymentAmount();
                return;
            }

            this.resetRegularDecisionSignals();
            this.resetRevisionSignals();
        });

    }

    readonly statusLabel = procedureStatusLabel;
    readonly genderLabel = genderLabel;
    readonly dateLabel = dateLabel;
    readonly formatYen = formatYen;

    officeSymbolPrefixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).prefix;
    }

    officeSymbolSuffixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).suffix;
    }

    yearMonthLabel(value: string | null | undefined): string {
        if (!value) return '—';
        const [y, m] = value.split('-');
        if (!y || !m) return '—';
        return `${y}年${m}月`;
    }

    /** リンク表示用（例: 2026-04 → 4月） */
    monthLabel(yearMonth: string): string {
        const month = Number(yearMonth.slice(5, 7));
        return `${month}月`;
    }

    formatDays(value: number | null | undefined): string {
        if (value === null || value === undefined) return '—';
        return String(value);
    }

    private resetRegularDecisionSignals(): void {
        this.missingMonthlyRewardMonths.set([]);
        this.averageMonthlyReward.set(null);
        this.rewardTotalSum.set(null);
        this.standardRemuneration.set(null);
        this.previousStandardRemuneration.set(null);
        this.previousRevisionMonth.set(null);
        this.regularDecisionMonths.set([]);
    }

    private resetRevisionSignals(): void {
        this.revisionPreviousMonthlyReward.set(null);
        this.revisionRevisedMonthlyReward.set(null);
        this.revisionReason.set(null);
    }

    private async loadRevisionData(
        procedure: Procedure,
        employee: Employee,
    ): Promise<void> {
        const applyYearMonth = procedure.targetYearMonth;
        if (!applyYearMonth) {
            this.resetRevisionSignals();
            return;
        }

        const originMonth = addMonthsToYearMonth(applyYearMonth, -3);

        try {
            const [rewards, bonuses, insuranceStatus] = await Promise.all([
                this.rewardService.listByEmployee(employee.id),
                employee.companyId
                    ? this.bonusRewardService.getBonusRewardsByEmployee(employee.companyId, employee.id)
                    : Promise.resolve([] as BonusReward[]),
                this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employee.id),
            ]);

            const healthInsuranceStartDate = insuranceStatus?.healthInsuranceStartDate ?? null;
            const qualificationDate = getQualificationDate(employee, healthInsuranceStartDate);
            if (!qualificationDate) {
                this.resetRevisionSignals();
                return;
            }

            const qualificationYearMonth = yearMonthFromDateString(qualificationDate);
            if (!qualificationYearMonth) {
                this.resetRevisionSignals();
                return;
            }

            const rewardsByYearMonth = Object.fromEntries(
                rewards.map((reward) => [reward.targetYearMonth, reward]),
            ) as Record<string, StandardMonthlyReward>;

            const firstRegularYm = getFirstRegularDeterminationYearMonth(qualificationDate);
            const eligibility = evaluateRevisionAtOrigin(
                originMonth,
                qualificationYearMonth,
                firstRegularYm,
                employee,
                qualificationDate,
                rewardsByYearMonth,
                (monthlyReward) => this.calculator.calculate(monthlyReward),
                bonuses,
            );

            const originReward = rewardsByYearMonth[originMonth] ?? null;
            this.revisionReason.set(this.formatRevisionReason(originReward, eligibility));

            const monthBeforeChange = addMonthsToYearMonth(originMonth, -1);
            const beforeReward = rewardsByYearMonth[monthBeforeChange];
            this.revisionPreviousMonthlyReward.set(
                beforeReward
                    ? effectiveMonthlyRewardTotal(beforeReward, monthBeforeChange, bonuses)
                    : null,
            );

            if (eligibility.eligible) {
                this.revisionRevisedMonthlyReward.set(eligibility.averageMonthlyReward);
                return;
            }

            const average = calculateRevisionAverageMonthlyReward(
                rewardsByYearMonth,
                originMonth,
                bonuses,
            );
            this.revisionRevisedMonthlyReward.set(average);
        } catch (error) {
            console.error('月額変更届の報酬情報の取得に失敗しました', error);
            this.resetRevisionSignals();
        }
    }

    private formatRevisionReason(
        originReward: StandardMonthlyReward | null,
        eligibility: ReturnType<typeof evaluateRevisionAtOrigin>,
    ): string | null {
        if (originReward?.changedFixedWageFields?.length) {
            return originReward.changedFixedWageFields
                .map((key) => FIXED_WAGE_FIELD_LABELS[key as FixedWageFieldKey] ?? key)
                .join('、');
        }

        if (eligibility.eligible) {
            return '固定的賃金の変更';
        }

        switch (eligibility.reason) {
            case 'no_fixed_wage_change':
                return '固定的賃金の変更なし';
            case 'missing_months':
                return '算定に必要な報酬が未入力';
            case 'no_previous_grades':
                return '改定前の標準報酬月額が取得できません';
            case 'no_revised_grades':
                return '改定後の等級を判定できません';
            case 'insufficient_grade_difference':
                return '等級差が2未満のため随時改定の対象外';
            default:
                return null;
        }
    }

    private async loadRegularDecisionData(

        procedure: Procedure,

        employee: Employee,

    ): Promise<void> {

        const targetYearMonth = procedure.targetYearMonth;

        if (!targetYearMonth) {

            this.resetRegularDecisionSignals();

            return;

        }



        try {

            const [rewards, bonuses, insuranceStatus] = await Promise.all([

                this.rewardService.listByEmployee(employee.id),

                employee.companyId

                    ? this.bonusRewardService.getBonusRewardsByEmployee(employee.companyId, employee.id)

                    : Promise.resolve([] as BonusReward[]),

                this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employee.id),

            ]);



            const healthInsuranceStartDate = insuranceStatus?.healthInsuranceStartDate ?? null;

            const qualificationDate = getQualificationDate(employee, healthInsuranceStartDate);

            if (!qualificationDate) {

                this.resetRegularDecisionSignals();

                return;

            }



            const qualificationYearMonth = yearMonthFromDateString(qualificationDate);

            if (!qualificationYearMonth) {

                this.resetRegularDecisionSignals();

                return;

            }



            const rewardsByYearMonth = Object.fromEntries(

                rewards.map((reward) => [reward.targetYearMonth, reward]),

            ) as Record<string, StandardMonthlyReward>;



            const baseYear = getRegularDecisionProcedureBaseYear(targetYearMonth);

            const baseMonths = getRegularBaseMonths(employee, baseYear, qualificationDate);

            const calculationMonths = getRegularCalculationMonths(employee, baseYear, qualificationDate);

            const baseMonthSet = new Set(baseMonths);



            const missingMonths = baseMonths.filter((ym) => !rewardsByYearMonth[ym]);

            this.missingMonthlyRewardMonths.set(missingMonths);



            this.regularDecisionMonths.set(

                getAprJunYearMonths(baseYear).map((yearMonth) =>

                    this.buildMonthBreakdown(

                        yearMonth,

                        employee,

                        qualificationDate,

                        rewardsByYearMonth[yearMonth] ?? null,

                        bonuses,

                        baseMonthSet.has(yearMonth),

                    ),

                ),

            );



            const previousMonth = `${baseYear}-08`;

            const firstRegularYm = getFirstRegularDeterminationYearMonth(qualificationDate);

            const previousWinner = pickWinningDeterminationCandidate(

                previousMonth,

                qualificationYearMonth,

                firstRegularYm,

                employee,

                qualificationDate,

                rewardsByYearMonth,

                (monthlyReward) => this.calculator.calculate(monthlyReward),

                bonuses,

            );

            this.previousRevisionMonth.set(previousWinner?.effectiveFrom ?? null);



            const previousEffective = this.determinationService.resolve(

                employee,

                rewardsByYearMonth,

                previousMonth,

                healthInsuranceStartDate,

                bonuses,

            );

            this.previousStandardRemuneration.set(

                previousEffective.isComplete && previousEffective.calculation?.health

                    ? previousEffective.calculation.health.standardMonthlyAmount

                    : null,

            );



            if (calculationMonths.length === 0 || missingMonths.length > 0) {

                this.averageMonthlyReward.set(null);

                this.rewardTotalSum.set(null);

                this.standardRemuneration.set(null);

                return;

            }



            const total = calculationMonths.reduce(

                (sum, yearMonth) =>

                    sum +

                    effectiveMonthlyRewardTotal(

                        rewardsByYearMonth[yearMonth],

                        yearMonth,

                        bonuses,

                    ),

                0,

            );

            const average = Math.round(total / calculationMonths.length);

            const calculation = this.calculator.calculate(average);



            this.rewardTotalSum.set(total);

            this.averageMonthlyReward.set(average);

            this.standardRemuneration.set(

                calculation.health && calculation.pension

                    ? {

                          health: calculation.health.standardMonthlyAmount,

                          pension: calculation.pension.standardMonthlyAmount,

                      }

                    : null,

            );

        } catch (error) {

            console.error('算定基礎届の報酬情報の取得に失敗しました', error);

            this.resetRegularDecisionSignals();

        }

    }



    private buildMonthBreakdown(

        yearMonth: string,

        employee: Employee,

        qualificationDate: string,

        reward: StandardMonthlyReward | null,

        bonuses: BonusReward[],

        isInBaseMonths: boolean,

    ): RegularDecisionMonthBreakdown {

        if (!isInBaseMonths) {

            return {

                yearMonth,

                paymentBaseDays: null,

                cashAmount: null,

                inKindAmount: null,

                totalAmount: null,

            };

        }



        const paymentBaseDays = getPaymentBaseDays(

            yearMonth,

            qualificationDate,

            employee.retiredDate,

        );



        if (!reward) {

            return {

                yearMonth,

                paymentBaseDays,

                cashAmount: null,

                inKindAmount: null,

                totalAmount: null,

            };

        }



        const totalAmount = effectiveMonthlyRewardTotal(reward, yearMonth, bonuses);



        return {

            yearMonth,

            paymentBaseDays,

            cashAmount: totalAmount,

            inKindAmount: 0,

            totalAmount,

        };

    }

    async submitProcedure(): Promise<void> {
        const item = this.procedure();
        if (item.status === 'completed' || this.isSubmitting()) return;

        this.isSubmitting.set(true);
        this.submitErrorMessage.set('');

        try {
            const updated = await this.procedureService.markProcedureAsSubmitted(item);
            this.procedureUpdated.emit(updated);
        } catch (error) {
            console.error('手続きの提出済み処理に失敗しました', error);
            this.submitErrorMessage.set('提出済みにする処理に失敗しました');
        } finally {
            this.isSubmitting.set(false);
        }
    }

}


