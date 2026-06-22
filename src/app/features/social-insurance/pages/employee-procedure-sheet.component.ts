import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { Procedure } from '../models/procedures.model';
import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';
import { ProcedureActionBarComponent } from '../components/procedure-action-bar.component';
import { ProcedureDetailHeaderComponent } from '../components/procedure-detail-header.component';
import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { splitOfficeSymbol } from '../../company/utils/office-format.util';
import {
    dateLabel,
    genderLabel,
    procedureStatusLabel,
    todayDateString,
} from '../utils/procedure-display.util';
import {
    isRegularDecisionProcedureSubmissionAllowed,
    regularDecisionProcedureDueDate,
    regularDecisionProcedureSubmissionStartDate,
} from '../utils/procedure-due-date.util';
import { StandardMonthlyRewardService } from '../../insurance/services/standard-monthly-reward.service';
import {
    getFirstRegularDeterminationYearMonth,
    getPaymentBaseDaysForPayMonth,
    getQualificationDate,
    getRegularBaseMonths,
    getRegularCalculationMonths,
    getRegularDecisionProcedureBaseYear,
    getRegularDeterminationPaymentMonths,
    getRegularDeterminationRewardMonths,
} from '../../insurance/utils/standard-remuneration-determination.util';
import { StandardMonthlyRewardCalculatorService } from '../../insurance/services/standard-monthly-reward-calculator.service';
import { StandardRemunerationDeterminationService } from '../../insurance/services/standard-remuneration-determination.service';
import { RouterLink } from '@angular/router';
import { addMonthsToYearMonth, yearMonthFromDateString } from '../../insurance/utils/reward-target-month.util';
import {
    formatPayYearMonthLabelFromWorkMonth,
    resolvePayMonthFromWorkMonth,
    resolvePayMonthQueryFromWorkMonth,
} from '../../insurance/utils/reward-pay-month.util';
import { effectiveMonthlyRewardTotal } from '../../insurance/utils/effective-monthly-reward.util';
import {
    evaluateRevisionAtOrigin,
    pickWinningDeterminationCandidate,
} from '../../insurance/utils/determination-precedence.util';
import {
    calculateRevisionAverageMonthlyReward,
    formatRevisionApplyFromPayMonthLabel,
    monthlyRewardTotal,
} from '../../insurance/utils/revision-determination.util';
import {
    FIXED_WAGE_FIELD_LABELS,
    FixedWageFieldKey,
} from '../../insurance/utils/fixed-wage-change.util';
import { formatYen } from '../utils/qualification-reward.util';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { SocialInsuranceStatusService } from '../services/social-insurance-status.service';
import { StandardMonthlyReward } from '../../insurance/models/standard-monthly-reward.model';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { SocialInsuranceStatus } from '../models/social-insurance-status.model';
import { ProcedureCsvExportContext } from '../utils/procedure-csv-export.util';
import {
    validateBonusPaymentProcedureSubmit,
    validateRegularDecisionProcedureSubmit,
    validateRevisionProcedureSubmit,
} from '../utils/procedure-submit-validation.util';
import {
    buildSocialInsuranceJoinJudgmentContext,
    resolveRegularDeterminationMinPaymentBaseDays,
} from '../utils/social-insurance-join-status.util';

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
    imports: [ProcedureActionBarComponent, ProcedureDetailHeaderComponent, RouterLink, DecimalPipe],
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
    socialInsuranceStatus = input<SocialInsuranceStatus | null>(null);

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
    bonusPaymentAmount = signal<number | null>(null);
    bonusReward = signal<BonusReward | null>(null);

    async loadBonusPaymentAmount(): Promise<void> {
        this.bonusPaymentAmount.set(null);
        this.bonusReward.set(null);

        const employee = this.employee();
        if (!employee) return;

        const targetYearMonth = this.procedure().targetYearMonth;
        if (!targetYearMonth) return;

        try {
            const bonuses = await this.bonusRewardService.getBonusRewardsByEmployee(employee.companyId, employee.id);
            const bonus =
                bonuses.find((item) => item.targetYearMonth === targetYearMonth) ?? bonuses[0] ?? null;
            this.bonusReward.set(bonus);
            this.bonusPaymentAmount.set(bonus?.bonusAmount ?? null);
        } catch (error) {
            console.error('賞与額の取得に失敗しました', error);
        }
    }

    applicationYearMonth = computed(() => {
        const targetYearMonth = this.procedure().targetYearMonth;
        if (!targetYearMonth || this.variant() !== 'regularDecision') return null;
        return addMonthsToYearMonth(targetYearMonth, 3);
    });

    exportContext = computed((): ProcedureCsvExportContext => {
        const variant = this.variant();
        const procedure = this.procedure();

        if (variant === 'regularDecision') {
            const std = this.standardRemuneration();
            const average = this.averageMonthlyReward();
            const effectiveFrom = this.applicationYearMonth();
            if (!std || average === null || !effectiveFrom) return {};

            return {
                regularDecision: {
                    averageMonthlyReward: average,
                    healthStandardAmount: std.health,
                    pensionStandardAmount: std.pension,
                    effectiveFrom,
                    months: this.regularDecisionMonths().map((month) => ({
                        totalAmount: month.totalAmount ?? 0,
                        paymentBaseDays: month.paymentBaseDays ?? 0,
                    })),
                },
            };
        }

        if (variant === 'revision') {
            const revised = this.revisionRevisedMonthlyReward();
            const previous = this.revisionPreviousMonthlyReward();
            const targetYearMonth = procedure.targetYearMonth;
            if (revised === null || !targetYearMonth) return {};

            const calculation = this.calculator.calculate(revised);
            const offset = this.company().payrollPaymentMonthOffset ?? 1;
            const fixedWageChangeMonth = resolvePayMonthFromWorkMonth(
                addMonthsToYearMonth(targetYearMonth, -3),
                offset,
            );

            return {
                revision: {
                    fixedWageChangeMonth,
                    changeDescription: this.revisionReason() ?? '',
                    previousStandardAmount: previous ?? 0,
                    revisedStandardAmount:
                        calculation.health?.standardMonthlyAmount ?? revised,
                    effectiveFrom: resolvePayMonthFromWorkMonth(targetYearMonth, offset),
                    months: [],
                },
            };
        }

        if (variant === 'bonusPayment') {
            const bonus = this.bonusReward();
            if (!bonus) return {};
            return { bonusReward: bonus };
        }

        return {};
    });

    submitValidation = computed(() => {
        const variant = this.variant();
        const procedure = this.procedure();

        if (variant === 'regularDecision') {
            return validateRegularDecisionProcedureSubmit({
                employee: this.employee(),
                office: this.office(),
                company: this.company(),
                targetYearMonth: procedure.targetYearMonth,
                missingMonthlyRewardMonths: this.missingMonthlyRewardMonths(),
                averageMonthlyReward: this.averageMonthlyReward(),
                standardRemuneration: this.standardRemuneration(),
            });
        }

        if (variant === 'revision') {
            return validateRevisionProcedureSubmit({
                employee: this.employee(),
                office: this.office(),
                company: this.company(),
                targetYearMonth: procedure.targetYearMonth,
                revisionRevisedMonthlyReward: this.revisionRevisedMonthlyReward(),
                revisionReason: this.revisionReason(),
            });
        }

        return validateBonusPaymentProcedureSubmit({
            employee: this.employee(),
            office: this.office(),
            company: this.company(),
            targetYearMonth: procedure.targetYearMonth,
            bonusAmount: this.bonusPaymentAmount(),
            paymentDate: procedure.occurredDate,
            healthInsuranceStartDate: this.socialInsuranceStatus()?.healthInsuranceStartDate,
            healthInsuranceEndDate: this.socialInsuranceStatus()?.healthInsuranceEndDate,
        });
    });

    canSubmit = computed(() => this.submitValidation().ok);

    regularDecisionSubmissionPeriodNote = computed((): string | null => {
        if (this.variant() !== 'regularDecision') return null;
        if (this.procedure().status === 'completed') return null;

        const targetYearMonth = this.procedure().targetYearMonth;
        if (!targetYearMonth) return null;

        const baseYear = getRegularDecisionProcedureBaseYear(targetYearMonth);
        if (isRegularDecisionProcedureSubmissionAllowed(baseYear, todayDateString())) return null;

        const startDate = regularDecisionProcedureSubmissionStartDate(baseYear);
        const dueDate = regularDecisionProcedureDueDate(baseYear);
        return `提出期間は${dateLabel(startDate)}〜${dateLabel(dueDate)}です。内容の確認・CSV出力はこの期間外でも可能です。`;
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

    /** 月額変更届：改定年月（支給月表示） */
    revisionApplyFromLabel(): string {
        const applyFromWorkMonth = this.procedure().targetYearMonth;
        if (!applyFromWorkMonth) return '—';
        return formatRevisionApplyFromPayMonthLabel(
            applyFromWorkMonth,
            this.company().payrollPaymentMonthOffset ?? 1,
        );
    }

    /** リンク表示用（例: 2026-04 → 4月） */
    monthLabel(yearMonth: string): string {
        const month = Number(yearMonth.slice(5, 7));
        return `${month}月`;
    }

    /** 未入力報酬リンク：勤務月キー → 支給年月ラベル */
    rewardInputPayMonthLabel(workYearMonth: string): string {
        const offset = this.company().payrollPaymentMonthOffset ?? 1;
        return formatPayYearMonthLabelFromWorkMonth(workYearMonth, offset);
    }

    /** 未入力報酬リンク：勤務月キー → 支給年月 query param */
    rewardInputPayMonthQuery(workYearMonth: string): { ym: string } {
        const offset = this.company().payrollPaymentMonthOffset ?? 1;
        return { ym: resolvePayMonthQueryFromWorkMonth(workYearMonth, offset) };
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
                this.company().payrollPaymentMonthOffset ?? 1,
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
            case 'insufficient_payment_base_days':
                return '算定3か月のいずれかで支払基礎日数が17日未満のため随時改定の対象外';
            case 'grade_direction_mismatch':
                return '固定的賃金の変動方向と等級の変動方向が一致しないため随時改定の対象外';
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

            const joinJudgmentContext = buildSocialInsuranceJoinJudgmentContext(
                employee,
                insuranceStatus,
                this.office(),
            );
            const regularMinPaymentBaseDays = resolveRegularDeterminationMinPaymentBaseDays(
                joinJudgmentContext,
            );

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
            const payrollPaymentMonthOffset = this.company().payrollPaymentMonthOffset ?? 1;
            const baseMonths = getRegularBaseMonths(
                employee,
                baseYear,
                qualificationDate,
                payrollPaymentMonthOffset,
            );
            const calculationMonths = getRegularCalculationMonths(
                employee,
                baseYear,
                qualificationDate,
                payrollPaymentMonthOffset,
                regularMinPaymentBaseDays,
            );
            const paymentMonths = getRegularDeterminationPaymentMonths(baseYear);
            const rewardMonths = getRegularDeterminationRewardMonths(
                baseYear,
                payrollPaymentMonthOffset,
            );
            const baseMonthSet = new Set(baseMonths);

            const missingMonths = calculationMonths.filter((ym) => !rewardsByYearMonth[ym]);
            this.missingMonthlyRewardMonths.set(missingMonths);

            this.regularDecisionMonths.set(
                paymentMonths.map((paymentYm, index) =>
                    this.buildMonthBreakdown(
                        paymentYm,
                        rewardMonths[index]!,
                        employee,
                        qualificationDate,
                        rewardsByYearMonth[rewardMonths[index]!] ?? null,
                        bonuses,
                        baseMonthSet.has(rewardMonths[index]!),
                        payrollPaymentMonthOffset,
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

                payrollPaymentMonthOffset,

                [],

                regularMinPaymentBaseDays,

            );

            this.previousRevisionMonth.set(previousWinner?.effectiveFrom ?? null);



            const previousEffective = this.determinationService.resolve(

                employee,

                rewardsByYearMonth,

                previousMonth,

                healthInsuranceStartDate,

                bonuses,

                payrollPaymentMonthOffset,

                [],

                joinJudgmentContext,

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

        displayYearMonth: string,

        rewardYearMonth: string,

        employee: Employee,

        qualificationDate: string,

        reward: StandardMonthlyReward | null,

        bonuses: BonusReward[],

        isInBaseMonths: boolean,

        payrollPaymentMonthOffset: 0 | 1,

    ): RegularDecisionMonthBreakdown {

        if (!isInBaseMonths) {

            return {

                yearMonth: displayYearMonth,

                paymentBaseDays: null,

                cashAmount: null,

                inKindAmount: null,

                totalAmount: null,

            };

        }



        const paymentBaseDays = getPaymentBaseDaysForPayMonth(
            rewardYearMonth,
            qualificationDate,
            employee.retiredDate,
            payrollPaymentMonthOffset,
        );



        if (!reward) {

            return {

                yearMonth: displayYearMonth,

                paymentBaseDays,

                cashAmount: null,

                inKindAmount: null,

                totalAmount: null,

            };

        }



        const totalAmount = monthlyRewardTotal(reward);



        return {

            yearMonth: displayYearMonth,

            paymentBaseDays,

            cashAmount: totalAmount,

            inKindAmount: 0,

            totalAmount,

        };

    }

    async submitProcedure(): Promise<void> {
        const item = this.procedure();
        if (item.status === 'completed' || this.isSubmitting()) return;

        const validation = this.submitValidation();
        if (!validation.ok) return;

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


