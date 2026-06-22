import { Component, signal, inject, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter, map, skip, distinctUntilChanged } from 'rxjs';

import {
    StandardMonthlyReward,
    RewardForm,
    RewardFormFieldValue,
    StandardMonthlyRewardInput,
} from '../models/standard-monthly-reward.model';
import {
    StandardMonthlyRewardCalculation,
    StandardMonthlyRewardCalculatorService,
} from '../services/standard-monthly-reward-calculator.service';
import { StandardMonthlyRewardService } from '../services/standard-monthly-reward.service';
import { SalaryConditionService } from '../services/salary-condition.service';
import { StandardRemunerationDeterminationService } from '../services/standard-remuneration-determination.service';
import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import {
    addMonthsToYearMonth,
    bonusPaymentDateReason,
    clampNavigableYearMonth,
    dateStringFromTimestamp,
    inputableYearMonthMax,
    isRewardTargetMonth,
    navigableYearMonthMax,
    rewardTargetMonthReason,
    viewableYearMonthMin,
    yearMonthFromDateString,
} from '../utils/reward-target-month.util';
import { resolveBonusPaymentDateBounds } from '../../social-insurance/utils/procedure-date-range.util';
import {
    FIXED_WAGE_FIELD_KEYS,
    FIXED_WAGE_FIELD_LABELS,
    FixedWageFieldKey,
    sumFixedWageFields,
} from '../utils/fixed-wage-change.util';
import { findLatestRegisteredRewardBefore } from '../utils/latest-reward.util';
import { confirmedRewardsByYearMonth, normalizeRewardStatus, savedRewardsForPremiumCalculation } from '../utils/reward-status.util';
import {
    formatYearMonthLabel,
    getFirstRegularDeterminationYearMonth,
    getPaymentBaseDays,
    getPaymentBaseDaysForPayMonth,
    getQualificationDate,
    getRegularDeterminationRewardMonths,
    isRegularDecisionProcedureRequiredForBaseYear,
} from '../utils/standard-remuneration-determination.util';
import {
    evaluateRevisionEligibilityForPayMonth,
    formatRevisionEligibilityWarningMessage,
    hasEligibleRevisionBeforeMonth,
    listEligibleRevisionProcedureContextsForMonth,
    RevisionProcedureDisplayContext,
} from '../utils/determination-precedence.util';
import { Office } from '../../company/models/office.model';
import {
    APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
    Company,
    INSURANCE_PREMIUM_COLLECTION_TIMING_APP_NOTE,
    InsurancePremiumCollectionTiming,
} from '../../company/models/company.model';
import { CompanyService } from '../../company/services/company.service';
import {
    formatPayrollDeductionNote,
    formatPremiumCollectionSummary,
    formatZeroPremiumBeforeEmploymentReason,
    resolvePremiumLiabilityYearMonth,
    resolvePremiumDeductionApplyFromPayMonth,
    resolvePremiumStandardDeterminationYearMonth,
} from '../../company/utils/company-payroll-settings.util';
import { OfficeService } from '../../company/services/office.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { insuranceJoinStatus, SocialInsuranceStatus } from '../../social-insurance/models/social-insurance-status.model';
import { insuranceJoinStatusLabel } from '../../social-insurance/utils/social-insurance-status-display.util';
import {
    isCareInsurancePremiumTargetMonth,
    judgeCareInsuranceStatus,
} from '../../social-insurance/utils/care-insurance-period.util';
import {
    buildSocialInsuranceJoinJudgmentContext,
    resolveHealthInsuranceJoinStatus,
    resolvePensionInsuranceJoinStatus,
    resolveRegularDeterminationMinPaymentBaseDays,
} from '../../social-insurance/utils/social-insurance-join-status.util';
import {
    isHealthInsurancePremiumTargetMonth,
    isPensionInsurancePremiumTargetMonth,
} from '../../social-insurance/utils/age-premium-period.util';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import {
    aggregateConfirmedMonthlyBonusPayment,
    aggregateMonthlyBonusPayment,
} from '../../bonus/utils/aggregate-monthly-bonus-payment.util';
import {
    confirmedBonuses,
    isBonusDraft,
    normalizeBonusStatus,
} from '../../bonus/utils/bonus-status.util';
import {
    resolveDefaultBonusPaymentDate,
    validateBonusPaymentDateDuplicate,
} from '../../bonus/utils/bonus-payment-date.util';
import {
    bonusesForStandardBonusPremium,
    effectiveMonthlyRewardFromBase,
    monthlyBonusRemunerationAddition,
    shouldTreatBonusAsMonthlyRemuneration,
    sumBonusAmountInTargetPeriod,
} from '../utils/effective-monthly-reward.util';
import { resolveBonusPremiumableStandardAmounts } from '../utils/bonus-standard-amount-cap.util';
import {
    calculateInsurancePremiumShares,
    InsurancePremiumShares,
} from '../utils/insurance-premium-rounding.util';
import { resolveMonthlyPremiumStandardAmounts } from '../utils/insurance-premium-standard-amount.util';
import {
    buildEnrollmentUndeterminedMessage,
    InsurancePremiumAmountDisplay,
    isDefinitivelyNotEnrolledInSocialInsurance,
    NOT_SUBJECT_LABEL,
    premiumDisplayAmountValue,
    premiumDisplayIsAmount,
    premiumDisplayNote,
    premiumDisplayShowsZero,
    resolveInsurancePremiumAmountDisplay,
} from '../utils/insurance-premium-display.util';
import { SocialInsuranceProcedureService } from '../../social-insurance/services/social-insurance-procedure.service';
import { InsurancePremiumResultService } from '../services/insurance-premium-result.service';
import { InsurancePremiumCalculationService } from '../services/insurance-premium-calculation.service';
import { ManualInsurancePremiumRateService } from '../services/manual-insurance-premium-rate.service';
import {
    EMPTY_MANUAL_INSURANCE_PREMIUM_RATE_FORM,
    ManualInsurancePremiumRateForm,
    ManualInsurancePremiumRates,
} from '../models/manual-insurance-premium-rate.model';
import {
    AUTOMATIC_INSURANCE_RATE_AVAILABLE_FROM,
    healthInsuranceFiscalYear,
    manualRatePairFromPercent,
    manualRatesMissingMessage,
    percentInputToDecimalRate,
    resolveInsurancePremiumRates,
    savedRateToPercentInput,
} from '../utils/insurance-premium-rate-resolution.util';
import { Procedure, ProcedureStatus } from '../../social-insurance/models/procedures.model';
import { dateLabel, formatProcedureNudgeDueOrSubmitted, isProcedureOverdue, todayDateString } from '../../social-insurance/utils/procedure-display.util';
import {
    procedureDueDateFromOccurredDate,
    qualificationProcedureDueDate,
    regularDecisionProcedureDueDate,
} from '../../social-insurance/utils/procedure-due-date.util';
import { isPartTimeEmployment } from '../../social-insurance/utils/part-time-insurance-judgment.util';
import {
    resolveQualificationJoinMonthReward,
    resolveQualificationMonthlyReward,
} from '../../social-insurance/utils/qualification-reward.util';
import {
    getDaysInMonth,
    resolveDaysInMonthForPayMonth,
    resolveMonthlyRewardWithEnrollmentProration,
} from '../utils/monthly-reward-proration.util';
import {
    partTimeInsuranceMonthlyRewardFromRecord,
    partTimeMonthlyRewardTotal,
    partTimeOtherAllowanceTotal,
} from '../utils/part-time-reward.util';
import { FieldHelpTooltipComponent } from '../../../shared/components/field-help-tooltip.component';
import { SalaryConditionModalComponent } from '../components/salary-condition-modal.component';
import { SalaryConditionHistoryModalComponent } from '../components/salary-condition-history-modal.component';
import { SalaryConditionDisplayComponent } from '../components/salary-condition-display.component';
import { CollapsibleWageSectionComponent } from '../components/collapsible-wage-section.component';
import { RewardProcedureNudgeComponent } from '../components/reward-procedure-nudge.component';
import {
    SalaryCondition,
    SalaryConditionFormValue,
    SalaryConditionPeriod,
} from '../models/salary-condition.model';
import {
    buildSalaryConditionPeriods,
    fixedWageFieldsFromSalaryCondition,
    formValueFromSalaryCondition,
    resolveEarliestSalaryConditionMonth,
    resolveSalaryConditionForMonth,
    salaryConditionInputFromForm,
    validateSalaryConditionForm,
} from '../utils/salary-condition.util';
import {
    buildSalaryConditionRewardDraftInput,
    listRewardMonthsToSyncFromSalaryCondition,
} from '../utils/salary-condition-sync.util';
import {
    findEmployeeOldestUnregisteredPayYearMonth,
    formatYearMonthLabel as formatRewardNavigationYearMonthLabel,
} from '../utils/reward-input-navigation.util';
import {
    clampRewardNavigationPayYearMonth,
    findLatestConfirmedPayYearMonth,
    formatPayMonthListFromWorkMonths,
    formatPayYearMonthLabelFromWorkMonth,
    isJoinPayMonthView as isEmployeeJoinPayMonthView,
    isJoinMonthWithNextMonthPay,
    isJoinMonthZeroPremiumDeductionView,
    isPremiumBasisRewardConfirmed,
    isSalaryPayMonthTarget,
    joinPayMonthDisplayNote,
    lookupRewardByPayMonth,
    rewardNavigationMinPayYearMonth,
    rewardRecordKeyForPayMonth,
    salaryPayMonthTargetReason,
    salaryPayYearMonthMax,
} from '../utils/reward-pay-month.util';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { formatRevisionApplyFromPayMonthLabel, getRevisionApplyFromMonth } from '../utils/revision-determination.util';

type MonthRewardStatus = 'loading' | 'draft' | 'confirmed' | 'unregistered' | 'excluded';
type PremiumPageMode = 'input' | 'premium';

@Component({
    selector: 'app-insurance-premium-detail-page',
    standalone: true,
    imports: [
        FormsModule,
        DecimalPipe,
        RouterLink,
        FieldHelpTooltipComponent,
        SalaryConditionModalComponent,
        SalaryConditionHistoryModalComponent,
        SalaryConditionDisplayComponent,
        CollapsibleWageSectionComponent,
        RewardProcedureNudgeComponent,
    ],
    templateUrl: './insurance-premium-detail-page.component.html',
})
export class InsurancePremiumDetailPageComponent {
    readonly premiumDisplayAmountValue = premiumDisplayAmountValue;
    readonly premiumDisplayShowsZero = premiumDisplayShowsZero;
    readonly premiumDisplayNote = premiumDisplayNote;
    readonly premiumDisplayIsAmount = premiumDisplayIsAmount;

    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly calculator = inject(StandardMonthlyRewardCalculatorService);
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly salaryConditionService = inject(SalaryConditionService);
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly employeeService = inject(EmployeeService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly officeService = inject(OfficeService);
    private readonly companyService = inject(CompanyService);
    private readonly bonusRewardService = inject(BonusRewardService);
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly premiumResultService = inject(InsurancePremiumResultService);
    private readonly premiumCalculationService = inject(InsurancePremiumCalculationService);
    private readonly manualRateService = inject(ManualInsurancePremiumRateService);
    private readonly confirmService = inject(ConfirmService);

    constructor() {
        this.router.events
            .pipe(
                filter((event): event is NavigationEnd => event instanceof NavigationEnd),
                takeUntilDestroyed(),
            )
            .subscribe(() => {
                const newMode = this.readPageModeFromRoute();
                if (newMode === this.pageMode()) return;

                this.pageMode.set(newMode);

                const employee = this.employee();
                if (!employee) return;

                const ym = this.targetYearMonth();
                const clamped = newMode === 'premium'
                    ? clampNavigableYearMonth(employee, ym, this.currentYearMonth(), {
                        scope: 'premium_view',
                        timing: this.insurancePremiumCollectionTiming(),
                        latestConfirmedWorkYearMonth: this.latestConfirmedWorkYearMonth(),
                    })
                    : clampRewardNavigationPayYearMonth(
                        employee,
                        ym,
                        this.currentYearMonth(),
                        this.payrollPaymentMonthOffset(),
                    );
                if (clamped !== ym) {
                    void this.onTargetYearMonthChange(clamped);
                }
            });

        this.route.queryParamMap.pipe(
            map((params) => params.get('ym')),
            skip(1),
            distinctUntilChanged(),
            filter((ym): ym is string => Boolean(ym && /^\d{4}-\d{2}$/.test(ym))),
            takeUntilDestroyed(),
        ).subscribe((ym) => {
            void this.onTargetYearMonthChange(ym);
        });
    }

    readonly premiumStandardAmountHelpLines = [
        '標準報酬月額は、資格取得時・定時決定・随時改定のルールに基づき決まります。',
        '算定に必要な月の報酬を保存すると、保険料を表示します。',
    ];

    readonly premiumCalculationHelpLines = [
        '保険料 ＝ 標準報酬月額（または標準賞与額）× 料率です。',
        '本人負担分のみ端数処理（50銭以下切捨て・50銭超切上げ）し、会社負担分は保険料全体から差し引きます。',
        '健保料率は事業所の都道府県に応じた協会けんぽ料率を使用します。',
        '保存済みの報酬・賞与をもとに、翌月徴収（前月分を当月給与から控除）で表示します。',
        INSURANCE_PREMIUM_COLLECTION_TIMING_APP_NOTE,
        '対象外の月や未加入の保険は「—」と表示します。',
    ];

    readonly payrollDeductionHelpLines = [
        '表示中の年月は、給与から控除する月です。',
        '翌月徴収のため、4月分の保険料は5月の給与から控除され、4月の画面では月次保険料は0円です。',
        INSURANCE_PREMIUM_COLLECTION_TIMING_APP_NOTE,
    ];

    readonly bonusStandardAmountLimitHelpLines = [
        '健康保険・介護保険：年度累計 573万円が上限',
        '※年度は4月1日〜翌年3月31日',
        '厚生年金保険：1か月あたり 150万円が上限',
        '※同じ月に複数回賞与がある場合は合算して150万円まで',
    ];

    readonly bonusHealthCareStandardAmountLimitHelpLines = [
        '健康保険・介護保険：年度累計 573万円が上限',
        '※年度は4月1日〜翌年3月31日',
    ];

    readonly bonusPensionStandardAmountLimitHelpLines = [
        '厚生年金保険：1か月あたり 150万円が上限',
        '※同じ月に複数回賞与がある場合は合算して150万円まで',
    ];

    standardReward = signal<StandardMonthlyReward | null>(null); // 標準報酬月額
    employeeRewards = signal<Record<string, StandardMonthlyReward>>({}); // 従業員の報酬月額
    salaryConditions = signal<SalaryCondition[]>([]);
    showSalaryConditionModal = signal(false);
    showSalaryConditionHistoryModal = signal(false);
    salaryConditionModalInitial = signal<SalaryConditionFormValue | null>(null);
    salaryConditionEditingMonth = signal<string | null>(null);
    salaryConditionSaveError = signal('');
    isSavingSalaryCondition = signal(false);
    healthInsuranceStartDate = signal<string | null>(null); // 健康保険の資格取得日
    healthInsuranceEndDate = signal<string | null>(null); // 健康保険の資格喪失日
    pensionInsuranceStartDate = signal<string | null>(null); // 厚生年金の資格取得日
    pensionInsuranceEndDate = signal<string | null>(null); // 厚生年金の資格喪失日
    healthInsuranceStatus = signal<insuranceJoinStatus | null>(null); // 健康保険の加入判定
    pensionInsuranceStatus = signal<insuranceJoinStatus | null>(null); // 厚生年金の加入判定
    careInsuranceStatus = signal<insuranceJoinStatus | null>(null); // 介護保険の加入判定
    socialInsuranceStatus = signal<SocialInsuranceStatus | null>(null);

    // 報酬フォーム
    rewardForm: RewardForm = {
        targetYearMonth: '',
        basicSalary: '',
        commutingAllowance: '',
        positionAllowance: '',
        housingAllowance: '',
        fixedOvertimePay: '',
        otherFixedAllowance: '',
        overtimePay: '',
        holidayPay: '',
        nightPay: '',
        commissionPay: '',
        otherVariablePay: '',
    };

    // 賞与
    employeeBonuses = signal<BonusReward[]>([]);
    monthBonuses = signal<BonusReward[]>([]);
    isBonusFormVisible = signal(false);
    bonusForm = {
        paymentDate: '',
        bonusAmount: '' as number | '',
    };

    // ローディング
    isLoading = signal(false);
    isLoadingMonth = signal(false);
    isSaving = signal(false);
    showVariableWageFields = signal(false);
    showFixedWageFields = signal(true);
    isConfirmingMonth = signal(false);
    isLoadingBonus = signal(false);
    isSavingBonus = signal(false);
    isDeletingBonus = signal(false);
    // メッセージ
    errorMessage = signal<string>('');
    message = signal<string>('');
    bonusMessage = signal<string>('');
    bonusErrorMessage = signal<string>('');
    manualRates = signal<ManualInsurancePremiumRates | null>(null);
    manualRateForm = signal<ManualInsurancePremiumRateForm>({ ...EMPTY_MANUAL_INSURANCE_PREMIUM_RATE_FORM });
    isSavingManualRates = signal(false);
    manualRateMessage = signal('');
    manualRateErrorMessage = signal('');
    readonly manualRateHelpLines = [
        `${formatYearMonthLabel(AUTOMATIC_INSURANCE_RATE_AVAILABLE_FROM)}より前の根拠月は、協会けんぽ等の料率データがアプリ内にないため自動取得できません。`,
        'その月に適用される健康保険・介護保険・厚生年金の料率（%）を入力してください。保存後、保険料の計算に使用されます。',
        '本人負担と会社負担は折半のため、同じ料率を入力します。',
    ];

    // 従業員
    employeeId = signal<string>('');
    employee = signal<Employee | null>(null);

    isPartTimeEmployee = computed(() => isPartTimeEmployment(this.employee()?.employmentType ?? null));

    // 事業所
    office = signal<Office | null>(null);
    company = signal<Company | null>(null);

    payrollPaymentMonthOffset = computed((): 0 | 1 =>
        this.company()?.payrollPaymentMonthOffset ?? 1,
    );

    /** 報酬レコードの targetYearMonth（支給年月） */
    workYearMonth = computed((): string => {
        return this.targetYearMonth();
    });

    workYearMonthLabel = computed(() => {
        const ym = this.workYearMonth();
        return ym ? formatYearMonthLabel(ym) : '';
    });

    insurancePremiumCollectionTiming = signal<InsurancePremiumCollectionTiming>(
        APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
    );

    readonly insurancePremiumCollectionTimingAppNote = INSURANCE_PREMIUM_COLLECTION_TIMING_APP_NOTE;
    // 対象年月
    targetYearMonth = signal<string>('');
    targetYearMonthLabel = computed(() => formatYearMonthLabel(this.targetYearMonth()));
    pageMode = signal<PremiumPageMode>('input');

    oldestUnregisteredYearMonth = computed(() => {
        const employee = this.employee();
        if (!employee || this.pageMode() !== 'input') return null;
        this.employeeRewards();
        return findEmployeeOldestUnregisteredPayYearMonth(
            employee,
            this.employeeRewards(),
            this.payrollPaymentMonthOffset(),
            this.targetYearMonth(),
        );
    });

    oldestUnregisteredYearMonthLabel = computed(() => {
        const ym = this.oldestUnregisteredYearMonth();
        return ym ? formatRewardNavigationYearMonthLabel(ym) : '';
    });

    showOldestUnregisteredLink = computed(() => {
        const oldest = this.oldestUnregisteredYearMonth();
        return Boolean(oldest && oldest !== this.targetYearMonth());
    });

    joinPayYearMonth = computed((): string | null => {
        const employee = this.employee();
        if (!employee) return null;
        return rewardNavigationMinPayYearMonth(employee);
    });

    joinPayYearMonthLabel = computed(() => {
        const ym = this.joinPayYearMonth();
        return ym ? formatRewardNavigationYearMonthLabel(ym) : '';
    });

    listBackRoute = computed(() => (this.pageMode() === 'input' ? '/rewards' : '/premium'));

    payrollDeductionNote = computed(() => {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return '';
        return formatPayrollDeductionNote(targetYearMonth, this.insurancePremiumCollectionTiming());
    });

    premiumCollectionSummary = computed(() => {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return '';
        return formatPremiumCollectionSummary(targetYearMonth, this.insurancePremiumCollectionTiming());
    });

    /** 給与控除画面で計算する保険料の対象月（翌月徴収時は選択月の前月） */
    premiumLiabilityYearMonth = computed((): string | null => {
        const displayYearMonth = this.targetYearMonth();
        if (!displayYearMonth) return null;
        return resolvePremiumLiabilityYearMonth(
            displayYearMonth,
            this.insurancePremiumCollectionTiming(),
        );
    });

    premiumLiabilityYearMonthLabel = computed(() => {
        const ym = this.premiumLiabilityYearMonth();
        return ym ? formatYearMonthLabel(ym) : '';
    });

    latestConfirmedWorkYearMonth = computed((): string | null => {
        return findLatestConfirmedPayYearMonth(
            this.employeeRewards(),
            this.payrollPaymentMonthOffset(),
        );
    });

    resolvedPremiumRates = computed(() => {
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const employee = this.employee();
        if (!liabilityYearMonth || !employee) return null;
        return resolveInsurancePremiumRates({
            liabilityYearMonth,
            office: this.office(),
            employee,
            manualRates: this.manualRatesForCalculation(),
        });
    });

    private manualRatesForCalculation = computed((): ManualInsurancePremiumRates | null => {
        const saved = this.manualRates();
        const form = this.manualRateForm();
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const employee = this.employee();
        if (!liabilityYearMonth || !employee) return saved;

        const health = manualRatePairFromPercent(form.healthRatePercent);
        const care = manualRatePairFromPercent(form.careRatePercent);
        const pension = manualRatePairFromPercent(form.pensionRatePercent);

        const hasFormInput =
            health.employeeRate !== null
            || care.employeeRate !== null
            || pension.employeeRate !== null;
        if (!hasFormInput) return saved;

        return {
            id: saved?.id ?? '',
            companyId: employee.companyId,
            employeeId: employee.id,
            liabilityYearMonth,
            healthEmployeeRate: health.employeeRate ?? saved?.healthEmployeeRate ?? null,
            healthEmployerRate: health.employerRate ?? saved?.healthEmployerRate ?? null,
            careEmployeeRate: care.employeeRate ?? saved?.careEmployeeRate ?? null,
            careEmployerRate: care.employerRate ?? saved?.careEmployerRate ?? null,
            pensionEmployeeRate: pension.employeeRate ?? saved?.pensionEmployeeRate ?? null,
            pensionEmployerRate: pension.employerRate ?? saved?.pensionEmployerRate ?? null,
            createdAt: saved?.createdAt ?? ({} as ManualInsurancePremiumRates['createdAt']),
            updatedAt: saved?.updatedAt ?? ({} as ManualInsurancePremiumRates['updatedAt']),
        };
    });

    showManualRateInputSection = computed(() => {
        const resolved = this.resolvedPremiumRates();
        if (!resolved) return false;
        return (
            resolved.needsManualHealthRate
            || resolved.needsManualCareRate
            || resolved.needsManualPensionRate
        );
    });

    /** 保存済み手動料率のみで解決（ページ表示時の未設定判定用） */
    private resolvedPremiumRatesFromSaved = computed(() => {
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const employee = this.employee();
        if (!liabilityYearMonth || !employee) return null;
        return resolveInsurancePremiumRates({
            liabilityYearMonth,
            office: this.office(),
            employee,
            manualRates: this.manualRates(),
        });
    });

    manualRatesUnsetNotice = computed((): string | null => {
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const resolved = this.resolvedPremiumRatesFromSaved();
        if (!liabilityYearMonth || !resolved) return null;

        const needsManual =
            resolved.needsManualHealthRate
            || resolved.needsManualCareRate
            || resolved.needsManualPensionRate;
        if (!needsManual || manualRatesMissingMessage(resolved) === null) return null;

        return `${healthInsuranceFiscalYear(liabilityYearMonth)}年度の料率が設定されていないため、手動で入力してください。`;
    });

    manualRatesUnsetModalDismissedFor = signal<string | null>(null);

    showManualRatesUnsetModal = computed((): boolean => {
        if (this.isLoading() || this.isLoadingMonth()) return false;
        if (this.pageMode() !== 'premium') return false;
        if (!this.manualRatesUnsetNotice()) return false;
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!liabilityYearMonth) return false;
        return this.manualRatesUnsetModalDismissedFor() !== liabilityYearMonth;
    });

    isNextMonthCollection = computed(
        () => this.insurancePremiumCollectionTiming() === 'next_month',
    );

    viewableMinYearMonth = computed(() => {
        const employee = this.employee();
        if (!employee) return null;
        if (this.pageMode() === 'input') {
            return rewardNavigationMinPayYearMonth(employee);
        }
        return viewableYearMonthMin(employee);
    });

    canGoPrevMonth = computed(() => {
        const minYm = this.viewableMinYearMonth();
        const ym = this.targetYearMonth();
        return Boolean(minYm && ym && ym > minYm);
    });

    canGoNextMonth = computed(() => {
        const employee = this.employee();
        const ym = this.targetYearMonth();
        if (!employee || !ym) return false;
        if (this.pageMode() === 'input') {
            const maxYm = salaryPayYearMonthMax(
                employee,
                this.currentYearMonth(),
                this.payrollPaymentMonthOffset(),
            );
            return ym < maxYm;
        }
        const maxYm = navigableYearMonthMax(
            employee,
            this.currentYearMonth(),
            'premium_view',
            this.insurancePremiumCollectionTiming(),
            this.latestConfirmedWorkYearMonth(),
        );
        return ym < maxYm;
    });

    /** 保険料タブ：選択月＝給与から控除する月 */
    premiumTabLeadNote = computed((): string => {
        const payLabel = this.targetYearMonthLabel();
        if (!payLabel) return '';
        if (this.isNextMonthCollection()) {
            const basisLabel = this.premiumLiabilityYearMonthLabel();
            if (!basisLabel || basisLabel === payLabel) {
                return `${payLabel}に給与から控除する保険料を表示しています。`;
            }
            return `${payLabel}に払う保険料を表示しています（${basisLabel}の報酬に基づく）。`;
        }
        return `${payLabel}の報酬に基づき、${payLabel}に控除する保険料を表示しています。`;
    });

    /** 保険料算出の根拠月の報酬が未入力のときの案内 */
    premiumTabLeadRewardHint = computed((): string | null => {
        if (this.isPremiumEnrollmentUndetermined()) return null;
        if (this.isJoinMonthZeroPremiumDeductionView()) return null;

        const revisionHint = this.revisionMissingRewardHint();
        if (revisionHint) return revisionHint;

        if (this.liabilityMonthHasConfirmedReward()) return null;
        if (this.showZeroMonthlyPremiumDueToCollectionTiming()) return null;

        const basisLabel = this.premiumLiabilityYearMonthLabel();
        if (!basisLabel) return null;

        return `${basisLabel}の給与を入力してください。`;
    });

    private revisionMissingRewardHint = computed((): string | null => {
        const effective = this.effectiveStandardForPremium();
        if (
            effective?.determinationType !== 'revision'
            || effective.isComplete
            || effective.missingMonths.length === 0
        ) {
            return null;
        }

        const label = formatPayMonthListFromWorkMonths(
            effective.missingMonths,
            this.payrollPaymentMonthOffset(),
        );
        return `随時改定の算定に${label}の報酬が必要です。`;
    });

    hasUndeterminedPremiumDueToMissingReward = computed(
        (): boolean => this.premiumTabLeadRewardHint() !== null,
    );

    /** 報酬入力リンク先（未登録の算定月 or 保険料対象月の支給年月） */
    rewardInputQueryParamsForPremiumBasis = computed((): { ym?: string } => {
        const effective = this.effectiveStandardForPremium();
        if (
            effective?.determinationType === 'revision'
            && !effective.isComplete
            && effective.missingMonths.length > 0
        ) {
            return { ym: effective.missingMonths[0] };
        }

        const liabilityYm = this.premiumLiabilityYearMonth();
        if (!liabilityYm) return {};
        return { ym: liabilityYm };
    });

    /** 未確定時に案内する給与の月（保険料対象月 or 随時改定の算定月） */
    premiumUndeterminedRewardMonthLabel = computed((): string => {
        const effective = this.effectiveStandardForPremium();
        if (effective?.missingMonths.length) {
            return formatPayMonthListFromWorkMonths(
                effective.missingMonths,
                this.payrollPaymentMonthOffset(),
            );
        }
        return this.premiumLiabilityYearMonthLabel() || this.targetYearMonthLabel();
    });

    premiumSummaryKicker = computed(
        () => `${this.targetYearMonthLabel()}に払う保険料`,
    );

    premiumEmptyStateTitle = computed((): string => {
        if (this.isPremiumEnrollmentUndetermined()) {
            return '保険料を判定できません';
        }
        return '保険料を表示できません';
    });

    premiumEmptyStateNote = computed((): string => {
        const payLabel = this.targetYearMonthLabel();
        const basisLabel = this.premiumLiabilityYearMonthLabel();

        const enrollmentUndetermined = this.premiumEnrollmentUndeterminedReason();
        if (enrollmentUndetermined) {
            return enrollmentUndetermined;
        }

        if (this.isJoinMonthZeroPremiumDeductionView()) {
            const reason = this.premiumZeroMonthlyReason();
            if (reason) return reason;
        }

        if (!this.liabilityMonthHasConfirmedReward()) {
            const zeroPremiumReason = this.premiumZeroMonthlyReason();
            if (zeroPremiumReason) return zeroPremiumReason;

            if (this.isNextMonthCollection() && basisLabel && basisLabel !== payLabel) {
                return `${payLabel}に払う保険料を表示するには、${basisLabel}の報酬を確定してください。`;
            }
            return `${basisLabel || payLabel}の報酬を確定すると、保険料を表示できます。`;
        }

        const effective = this.effectiveStandardForPremium();
        if (effective && !effective.isComplete) {
            return effective.description;
        }

        return '算定に必要な情報が不足しているため、保険料を判定できません。';
    });

    isPremiumEnrollmentUndetermined = computed((): boolean => {
        return this.premiumEnrollmentUndeterminedReason() !== null;
    });

    premiumEnrollmentUndeterminedReason = computed((): string | null => {
        return buildEnrollmentUndeterminedMessage(
            this.healthInsuranceJoinStatus(),
            this.pensionInsuranceJoinStatus(),
        );
    });

    isMonthlyPremiumNotSubject = computed((): boolean => {
        if (this.hasMonthlyPremiumDisplay()) return false;
        if (this.isPremiumEnrollmentUndetermined()) return false;

        if (
            isDefinitivelyNotEnrolledInSocialInsurance(
                this.healthInsuranceJoinStatus(),
                this.pensionInsuranceJoinStatus(),
            )
        ) {
            return true;
        }

        return this.showZeroMonthlyPremiumDueToCollectionTiming();
    });

    premiumNotSubjectReason = computed((): string => {
        if (
            isDefinitivelyNotEnrolledInSocialInsurance(
                this.healthInsuranceJoinStatus(),
                this.pensionInsuranceJoinStatus(),
            )
        ) {
            return NOT_SUBJECT_LABEL;
        }

        return this.premiumZeroMonthlyReason() ?? NOT_SUBJECT_LABEL;
    });

    /** 月次保険料が0円となる場合の説明 */
    premiumZeroMonthlyReason = computed((): string | null => {
        if (!this.showZeroMonthlyPremiumDueToCollectionTiming()) return null;

        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const employee = this.employee();
        const joinYearMonth = employee ? yearMonthFromDateString(employee.joinedDate) : null;

        const beforeEmploymentReason = formatZeroPremiumBeforeEmploymentReason({
            payYearMonth: this.targetYearMonth(),
            joinYearMonth,
            liabilityYearMonth,
        });
        if (beforeEmploymentReason) return beforeEmploymentReason;

        if (!employee) {
            return NOT_SUBJECT_LABEL;
        }

        const qualificationDate = this.resolvedQualificationDate();
        const qualificationYearMonth = yearMonthFromDateString(qualificationDate);
        if (
            qualificationYearMonth
            && liabilityYearMonth
            && liabilityYearMonth < qualificationYearMonth
        ) {
            const qualificationLabel = formatYearMonthLabel(qualificationYearMonth);
            return `${NOT_SUBJECT_LABEL}（資格取得前。${qualificationLabel}以降の報酬に基づく保険料は、翌月以降の控除月で表示されます）`;
        }

        const effective = this.effectiveStandardForPremium();
        if (effective?.isComplete && !this.isAnyLiabilityPremiumMonth()) {
            return NOT_SUBJECT_LABEL;
        }

        return NOT_SUBJECT_LABEL;
    });

    premiumSectionTitle = computed(() => {
        const displayLabel = this.targetYearMonthLabel();
        if (this.isNextMonthCollection()) {
            const liabilityLabel = this.premiumLiabilityYearMonthLabel();
            if (!liabilityLabel) return `社会保険料（${displayLabel}）`;
            return `社会保険料（${liabilityLabel}分・${displayLabel}給与控除）`;
        }
        return `社会保険料（${displayLabel}分）`;
    });

    regularDecisionProcedure = signal<Procedure | null>(null);
    isCreatingRegularDecisionProcedure = signal(false);

    qualificationProcedure = signal<Procedure | null>(null);
    isCreatingQualificationProcedure = signal(false);

    /** 算定基礎届の対象支給月（4〜6月に支払われた給与）か */
    isRegularDecisionBaseMonth = computed((): boolean => {
        const payYearMonth = this.targetYearMonth();
        if (!/^\d{4}-\d{2}$/.test(payYearMonth)) return false;
        const baseYear = Number(payYearMonth.slice(0, 4));
        return getRegularDeterminationRewardMonths(
            baseYear,
            this.payrollPaymentMonthOffset(),
        ).includes(payYearMonth);
    });

    regularDecisionYearLabel = computed((): string => {
        const payYearMonth = this.targetYearMonth();
        if (!payYearMonth) return '';
        return `${payYearMonth.slice(0, 4)}年`;
    });

    /** 算定基礎届の対象年月キー（YYYY-06） */
    regularDecisionTargetYearMonth = computed((): string | null => {
        const payYearMonth = this.targetYearMonth();
        if (!this.isRegularDecisionBaseMonth()) return null;
        return `${payYearMonth.slice(0, 4)}-06`;
    });

    regularDecisionProcedureExists = computed(() => this.regularDecisionProcedure() !== null);

    regularDecisionProcedureStatus = computed((): ProcedureStatus => {
        return this.regularDecisionProcedure()?.status ?? 'notStarted';
    });

    /** 算定3か月が揃い随時改定が成立した場合、該当3か月すべてで月額変更届を表示（複数可） */
    revisionProcedureContexts = computed((): RevisionProcedureDisplayContext[] => {
        // 対象月が支給月であることを確認
        const payYearMonth = this.targetYearMonth();
        const employee = this.employee();
        if (!payYearMonth || !employee || !isRewardTargetMonth(employee, payYearMonth)) return [];

        // 資格取得月を取得
        const qualificationDate = this.resolvedQualificationDate();
        const qualificationYearMonth = qualificationDate
            ? yearMonthFromDateString(qualificationDate)
            : null;
        if (!qualificationDate || !qualificationYearMonth) return [];

        // 随時改定の対象月を取得
        return listEligibleRevisionProcedureContextsForMonth(
            payYearMonth,
            qualificationYearMonth,
            getFirstRegularDeterminationYearMonth(qualificationDate),
            employee,
            qualificationDate,
            confirmedRewardsByYearMonth(this.employeeRewards()),
            (monthlyReward) => this.calculator.calculate(monthlyReward),
            this.confirmedEmployeeBonuses(),
            this.payrollPaymentMonthOffset(),
            this.salaryConditions(),
            resolveRegularDeterminationMinPaymentBaseDays(this.socialInsuranceJoinJudgmentContext()),
        );
    });

    showRevisionProcedureSection = computed(() => this.revisionProcedureContexts().length > 0);

    /** 随時改定の成立状況に応じた注意（届出ナッジ表示中・成立済みは非表示） */
    revisionWarningMessage = computed((): string | null => {
        if (this.pageMode() !== 'input') return null;
        if (this.monthRewardStatus() !== 'confirmed') return null;
        if (this.showRevisionProcedureSection()) return null;

        const payYearMonth = this.targetYearMonth();
        const employee = this.employee();
        const qualificationDate = this.resolvedQualificationDate();
        if (!payYearMonth || !employee || !qualificationDate) return null;

        const qualificationYearMonth = yearMonthFromDateString(qualificationDate);
        if (!qualificationYearMonth) return null;

        const entry = evaluateRevisionEligibilityForPayMonth(
            payYearMonth,
            qualificationYearMonth,
            getFirstRegularDeterminationYearMonth(qualificationDate),
            employee,
            qualificationDate,
            confirmedRewardsByYearMonth(this.employeeRewards()),
            (monthlyReward) => this.calculator.calculate(monthlyReward),
            this.confirmedEmployeeBonuses(),
            this.payrollPaymentMonthOffset(),
            this.salaryConditions(),
            resolveRegularDeterminationMinPaymentBaseDays(this.socialInsuranceJoinJudgmentContext()),
        );

        if (entry) {
            return formatRevisionEligibilityWarningMessage(
                entry,
                this.changedFixedWageFieldLabels(),
                this.payrollPaymentMonthOffset(),
            );
        }

        const reward = this.standardReward();
        if (reward?.fixedWageChanged && this.changedFixedWageFieldLabels().length > 0) {
            return `前月から固定的賃金に変更があります（${this.changedFixedWageFieldLabels().join('・')}）。随時改定の起算月として認識されていないため、給与条件または報酬の確定状態を確認してください。`;
        }

        return null;
    });

    /** 同年9月の定時決定より先に随時改定が成立している */
    revisionSupersedesRegularDecision = computed(() => {
        const payYearMonth = this.targetYearMonth();
        const employee = this.employee();
        const qualificationDate = this.resolvedQualificationDate();
        if (!payYearMonth || !employee || !qualificationDate || !this.isRegularDecisionBaseMonth()) {
            return false;
        }

        const qualificationYearMonth = yearMonthFromDateString(qualificationDate);
        if (!qualificationYearMonth) return false;

        const baseYear = Number(payYearMonth.slice(0, 4));
        const regularEffectiveFrom = `${baseYear}-09`;

        return hasEligibleRevisionBeforeMonth(
            regularEffectiveFrom,
            qualificationYearMonth,
            getFirstRegularDeterminationYearMonth(qualificationDate),
            employee,
            qualificationDate,
            confirmedRewardsByYearMonth(this.employeeRewards()),
            (monthlyReward) => this.calculator.calculate(monthlyReward),
            this.confirmedEmployeeBonuses(),
            this.salaryConditions(),
            this.payrollPaymentMonthOffset(),
            resolveRegularDeterminationMinPaymentBaseDays(this.socialInsuranceJoinJudgmentContext()),
        );
    });

    /** 9月より前に随時改定が成立する場合は算定基礎届を表示しない */
    showRegularDecisionProcedureSection = computed(() => {
        if (!this.isRegularDecisionBaseMonth()) return false;
        if (this.showRevisionProcedureSection() || this.revisionSupersedesRegularDecision()) {
            return false;
        }

        const qualificationDate = this.resolvedQualificationDate();
        const payYearMonth = this.targetYearMonth();
        if (!qualificationDate || !payYearMonth) return false;

        const baseYear = Number(payYearMonth.slice(0, 4));
        return isRegularDecisionProcedureRequiredForBaseYear(qualificationDate, baseYear);
    });

    isQualificationMonth = computed((): boolean => {
        const employee = this.employee();
        const payYearMonth = this.targetYearMonth();
        const qualificationDate = this.resolvedQualificationDate();
        if (!employee || !payYearMonth || !qualificationDate) return false;

        const qualificationYearMonth = yearMonthFromDateString(qualificationDate);
        return qualificationYearMonth === payYearMonth;
    });

    isJoinPayMonthView = computed((): boolean => {
        const employee = this.employee();
        const payYearMonth = this.targetYearMonth();
        if (!employee || !payYearMonth) return false;
        return isEmployeeJoinPayMonthView(employee, payYearMonth);
    });

    /** 翌月徴収で控除月が入社月（保険料0円・報酬登録不要） */
    isJoinMonthZeroPremiumDeductionView = computed((): boolean => {
        const employee = this.employee();
        const payYearMonth = this.targetYearMonth();
        if (!employee || !payYearMonth) return false;
        return isJoinMonthZeroPremiumDeductionView(
            employee,
            payYearMonth,
            this.insurancePremiumCollectionTiming(),
        );
    });

    joinPayMonthDisplayNote = computed((): string | null => {
        const employee = this.employee();
        const payYearMonth = this.targetYearMonth();
        if (!employee || !payYearMonth) return null;
        return joinPayMonthDisplayNote(
            employee,
            payYearMonth,
            this.payrollPaymentMonthOffset(),
        );
    });

    /** 入社月は見込み給与を反映した固定的賃金を変更不可 */
    isJoinMonthFixedWageLocked = computed(
        () => this.isQualificationMonth() && !this.isPartTimeEmployee(),
    );

    usesSalaryConditionForFixedWage = computed(
        () => !this.isPartTimeEmployee() && this.salaryConditions().length > 0,
    );

    isFixedWageReadOnly = computed(
        () => this.usesSalaryConditionForFixedWage() || this.isJoinMonthFixedWageLocked(),
    );

    activeSalaryConditionForMonth = computed((): SalaryCondition | null => {
        const targetYearMonth = this.workYearMonth();
        if (!targetYearMonth) return null;
        return resolveSalaryConditionForMonth(this.salaryConditions(), targetYearMonth);
    });

    currentSalaryCondition = computed((): SalaryCondition | null => {
        const targetYearMonth = this.currentYearMonth();
        return resolveSalaryConditionForMonth(this.salaryConditions(), targetYearMonth);
    });

    salaryConditionPeriods = computed((): SalaryConditionPeriod[] =>
        buildSalaryConditionPeriods(this.salaryConditions()),
    );

    salaryConditionMinEffectiveMonth = computed((): string | null => {
        return resolveEarliestSalaryConditionMonth({
            joinedDate: this.employee()?.joinedDate,
            qualificationDate: this.resolvedQualificationDate(),
        });
    });

    confirmedRewardMonths = computed((): string[] =>
        Object.values(this.employeeRewards())
            .filter((reward) => normalizeRewardStatus(reward) === 'confirmed')
            .map((reward) => reward.targetYearMonth),
    );

    /** 入社月は見込み給与を反映した月額報酬を変更不可（パート） */
    isJoinMonthPartTimePayLocked = computed(
        () => this.isQualificationMonth() && this.isPartTimeEmployee(),
    );

    joinMonthFixedWageTotal = computed((): number => {
        this.formRewardRevision();
        const form = this.rewardForm;
        return sumFixedWageFields({
            basicSalary: this.toNumber(form.basicSalary),
            commutingAllowance: this.toNumber(form.commutingAllowance),
            positionAllowance: this.toNumber(form.positionAllowance),
            housingAllowance: this.toNumber(form.housingAllowance),
            fixedOvertimePay: this.toNumber(form.fixedOvertimePay),
            otherFixedAllowance: this.toNumber(form.otherFixedAllowance),
        });
    });

    fixedWageTotalDisplay = computed((): number => {
        this.formRewardRevision();
        const condition = this.activeSalaryConditionForMonth();
        if (this.isFixedWageReadOnly() && condition) {
            return condition.fixedWageTotal;
        }
        return this.joinMonthFixedWageTotal();
    });

    variableWageTotalDisplay = computed((): number => {
        this.formRewardRevision();
        const form = this.rewardForm;
        return (
            this.toNumber(form.overtimePay) +
            this.toNumber(form.holidayPay) +
            this.toNumber(form.nightPay) +
            this.toNumber(form.commissionPay) +
            this.toNumber(form.otherVariablePay)
        );
    });

    joinMonthPartTimeMonthlyPay = computed((): number => {
        this.formRewardRevision();
        return this.toNumber(this.rewardForm.basicSalary);
    });

    isHealthInsuranceEligible = computed((): boolean => {
        const status = this.socialInsuranceStatus();
        if (!status) return false;

        if (status.healthInsuranceStatus === 'active' && status.pensionInsuranceStatus === 'active') {
            return true;
        }
        if (status.healthInsuranceStatus === 'inactive' || status.pensionInsuranceStatus === 'inactive') {
            return false;
        }

        return (
            this.healthInsuranceJoinStatus() === 'active' &&
            this.pensionInsuranceJoinStatus() === 'active'
        );
    });

    showQualificationProcedureSection = computed(() => {
        if (!this.isHealthInsuranceEligible()) return false;
        if (this.qualificationProcedureStatus() === 'completed') return false;

        const qualificationDate = this.resolvedQualificationDate();
        const payYearMonth = this.targetYearMonth();
        if (!qualificationDate || !payYearMonth) return false;

        const firstRegularYm = getFirstRegularDeterminationYearMonth(qualificationDate);
        if (payYearMonth < firstRegularYm) return true;
        if (this.isJoinPayMonthView()) return true;
        if (this.qualificationProcedureExists()) return true;

        return false;
    });

    qualificationProcedureExists = computed(() => this.qualificationProcedure() !== null);

    qualificationProcedureStatus = computed((): ProcedureStatus => {
        return this.qualificationProcedure()?.status ?? 'notStarted';
    });

    qualificationProcedureDueDate = computed((): string => {
        const procedure = this.qualificationProcedure();
        if (procedure?.dueDate) return procedure.dueDate;

        const qualificationDate = this.resolvedQualificationDate();
        if (!qualificationDate) return '';
        return qualificationProcedureDueDate(qualificationDate);
    });

    isQualificationProcedureOverdue = computed((): boolean => {
        const dueDate = this.qualificationProcedureDueDate();
        if (!dueDate) return false;
        return isProcedureOverdue(
            {
                status: this.qualificationProcedureStatus(),
                dueDate,
            },
            todayDateString(),
        );
    });

    qualificationProcedureNudgeSummary = computed((): string | null => {
        const prefix = this.isJoinPayMonthView() ? '入社月' : null;
        const suffix = formatProcedureNudgeDueOrSubmitted(
            this.qualificationProcedureStatus(),
            this.qualificationProcedureDueDate(),
        );
        if (!suffix && !prefix) return null;
        if (prefix && suffix) return `${prefix} · ${suffix}`;
        return prefix || suffix;
    });

    revisionProceduresByApplyFrom = signal<Record<string, Procedure | null>>({});
    creatingRevisionApplyFrom = signal<string | null>(null);

    revisionProcedureExistsFor(applyFromMonth: string): boolean {
        return Boolean(this.revisionProceduresByApplyFrom()[applyFromMonth]);
    }

    revisionProcedureNudgeSummary(
        applyFromMonth: string,
        applyFromLabel: string,
        windowLabel: string,
    ): string {
        const base = `${applyFromLabel}（算定 ${windowLabel}）`;
        const procedure = this.revisionProceduresByApplyFrom()[applyFromMonth];
        if (procedure?.status === 'completed') {
            return `${base} · 提出済`;
        }
        return base;
    }

    isCreatingRevisionProcedureFor(applyFromMonth: string): boolean {
        return this.creatingRevisionApplyFrom() === applyFromMonth;
    }

    regularDecisionProcedureDueDate = computed((): string => {
        const procedure = this.regularDecisionProcedure();
        if (procedure?.dueDate) return procedure.dueDate;
        const targetYearMonth = this.regularDecisionTargetYearMonth();
        if (!targetYearMonth) return '';
        return regularDecisionProcedureDueDate(targetYearMonth);
    });

    isRegularDecisionProcedureOverdue = computed((): boolean => {
        const dueDate = this.regularDecisionProcedureDueDate();
        if (!dueDate) return false;
        return isProcedureOverdue(
            {
                status: this.regularDecisionProcedureStatus(),
                dueDate,
            },
            todayDateString(),
        );
    });

    regularDecisionProcedureNudgeSummary = computed((): string | null => {
        const year = this.regularDecisionYearLabel();
        const parts = [`${year}年4〜6月`];
        const suffix = formatProcedureNudgeDueOrSubmitted(
            this.regularDecisionProcedureStatus(),
            this.regularDecisionProcedureDueDate(),
        );
        if (suffix) parts.push(suffix);
        return parts.join(' ');
    });

    /** 未入力月を開いたとき、初期表示に使った直近登録済み月（YYYY-MM） */
    prefilledFromYearMonth = signal<string | null>(null);
    /** 未保存のフォーム合計を computed に反映するためのトリガ */
    private formRewardRevision = signal(0);

    // 月次報酬の算定結果
    effectiveStandard = computed(() => {
        const employee = this.employee();
        const yearMonth = this.workYearMonth();
        if (!employee || !yearMonth) return null;
        return this.determinationService.resolve(
            employee,
            this.rewardsForDisplayMonthCalculation(),
            yearMonth,
            this.healthInsuranceStartDate(),
            this.confirmedEmployeeBonuses(),
            this.payrollPaymentMonthOffset(),
            this.salaryConditions(),
            this.socialInsuranceJoinJudgmentContext(),
        );
    });

    /** 報酬パネル用。表示中の月のフォーム入力を算定に反映する */
    private rewardsForDisplayMonthCalculation = computed((): Record<string, StandardMonthlyReward> => {
        const yearMonth = this.workYearMonth();
        if (!yearMonth) return confirmedRewardsByYearMonth(this.employeeRewards());
        return this.buildRewardsWithFormPreview(yearMonth);
    });

    effectiveStandardForPremium = computed(() => {
        const employee = this.employee();
        const payYearMonth = this.targetYearMonth();
        if (!employee || !payYearMonth) return null;
        const standardDeterminationYearMonth = resolvePremiumStandardDeterminationYearMonth(
            payYearMonth,
            this.insurancePremiumCollectionTiming(),
        );
        return this.determinationService.resolve(
            employee,
            savedRewardsForPremiumCalculation(this.employeeRewards()),
            standardDeterminationYearMonth,
            this.healthInsuranceStartDate(),
            this.confirmedEmployeeBonuses(),
            this.payrollPaymentMonthOffset(),
            this.salaryConditions(),
            this.socialInsuranceJoinJudgmentContext(),
        );
    });

    /** 資格取得日（健保開始日が未設定のときは入社日） */
    resolvedQualificationDate = computed((): string | null => {
        const employee = this.employee();
        if (!employee) return null;
        return getQualificationDate(employee, this.healthInsuranceStartDate());
    });

    /** 保険料の根拠月の報酬が確定済みか */
    liabilityMonthHasConfirmedReward = computed((): boolean => {
        const payYearMonth = this.targetYearMonth();
        const employee = this.employee();
        if (!payYearMonth) return false;
        return isPremiumBasisRewardConfirmed(
            this.employeeRewards(),
            payYearMonth,
            this.insurancePremiumCollectionTiming(),
            this.payrollPaymentMonthOffset(),
            employee ? yearMonthFromDateString(employee.joinedDate) : null,
        );
    });

    /** 根拠月が健保・年金・介護のいずれかの保険料対象月か */
    isAnyLiabilityPremiumMonth = computed((): boolean => {
        return this.isHealthPremiumMonth()
            || this.isPensionPremiumMonth()
            || this.isCarePremiumMonth();
    });

    /** 翌月徴収で、対象月の給与控除として月次保険料が0円となる場合 */
    showZeroMonthlyPremiumDueToCollectionTiming = computed((): boolean => {
        if (this.isJoinMonthZeroPremiumDeductionView()) return true;

        if (this.hasMonthlyPremiumDisplay()) return false;

        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const employee = this.employee();
        if (!liabilityYearMonth || !employee) return false;

        if (
            isRewardTargetMonth(employee, liabilityYearMonth)
            && !this.liabilityMonthHasConfirmedReward()
        ) {
            return false;
        }

        const effective = this.effectiveStandardForPremium();
        if (effective?.isComplete && !this.isAnyLiabilityPremiumMonth()) {
            return true;
        }

        if (!this.isNextMonthCollection()) return false;

        if (!isRewardTargetMonth(employee, liabilityYearMonth)) return true;

        const joinYearMonth = yearMonthFromDateString(employee.joinedDate);
        if (joinYearMonth && liabilityYearMonth < joinYearMonth) return true;

        const qualificationDate = this.resolvedQualificationDate();
        const qualificationYearMonth = yearMonthFromDateString(qualificationDate);
        if (qualificationYearMonth && liabilityYearMonth < qualificationYearMonth) {
            return true;
        }

        return false;
    });

    /** 対象月の暦年で賞与が年4回以上の場合、報酬月額に算入する */
    treatBonusAsMonthlyRemuneration = computed(() => {
        const yearMonth = this.targetYearMonth();
        if (!yearMonth) return false;
        return shouldTreatBonusAsMonthlyRemuneration(this.confirmedEmployeeBonuses(), yearMonth);
    });

    /** 標準賞与額・賞与保険料の対象（年4回以上の場合は除外） */
    bonusesForPremium = computed(() => {
        const payYearMonth = this.targetYearMonth();
        if (!payYearMonth) return [];
        const bonusesInPayMonth = this.confirmedEmployeeBonuses().filter(
            (bonus) => bonus.targetYearMonth === payYearMonth,
        );
        const liabilityYearMonth = this.premiumLiabilityYearMonth() ?? payYearMonth;
        return bonusesForStandardBonusPremium(
            bonusesInPayMonth,
            liabilityYearMonth,
            this.confirmedEmployeeBonuses(),
        );
    });

    /** 報酬月額に算入した賞与額（対象期間の賞与合計 ÷ 12） */
    includedBonusInMonth = computed(() => {
        if (!this.treatBonusAsMonthlyRemuneration()) return 0;
        const yearMonth = this.targetYearMonth();
        if (!yearMonth) return 0;
        return monthlyBonusRemunerationAddition(this.confirmedEmployeeBonuses(), yearMonth);
    });

    /** 対象期間内の賞与支給額合計（算入表示用） */
    bonusTotalInTargetPeriod = computed(() => {
        const yearMonth = this.targetYearMonth();
        if (!yearMonth) return 0;
        return sumBonusAmountInTargetPeriod(this.confirmedEmployeeBonuses(), yearMonth);
    });

    /** 当月登録済み・下書きの賞与合計（報酬月額パネル用） */
    monthBonusTotalInPayMonth = computed(() =>
        this.monthBonuses().reduce((sum, bonus) => sum + (bonus.bonusAmount ?? 0), 0),
    );

    monthBonusSummaryHint = computed((): string => {
        if (this.treatBonusAsMonthlyRemuneration()) {
            return '年4回以上の賞与のため、標準報酬月額に算入します（下の「うち賞与算入」を参照）';
        }
        return '給与の報酬月額とは別扱いです（賞与保険料の計算に使用）';
    });

    // 月次報酬のステータス
    monthRewardStatus = computed((): MonthRewardStatus => {
        if (this.isLoadingMonth()) return 'loading';
        const employee = this.employee();
        const payYearMonth = this.targetYearMonth();
        if (!employee || !payYearMonth) return 'unregistered';
        if (!this.isSalaryInputTargetMonth()) return 'excluded';

        const status = normalizeRewardStatus(this.standardReward());
        if (status === 'draft') return 'draft';
        if (status === 'confirmed') return 'confirmed';
        return 'unregistered';
    });

    /** 下書き・未登録の月次報酬、または月次報酬確定後の賞与追加 */
    isRewardEditable = computed(() => {
        if (!this.isSalaryInputTargetMonth()) return false;
        const status = this.monthRewardStatus();
        return status === 'unregistered' || status === 'draft';
    });

    canManageBonuses = computed(() => {
        if (this.isLoadingMonth() || this.isLoadingBonus() || !this.isTargetMonth()) {
            return false;
        }
        return this.isSalaryInputTargetMonth();
    });

    isBonusEditable = computed(() => {
        if (!this.canManageBonuses()) return false;
        if (this.isRewardEditable()) return true;
        return this.monthRewardStatus() === 'confirmed';
    });

    draftBonusesInMonth = computed(() =>
        this.monthBonuses().filter((bonus) => isBonusDraft(bonus)),
    );

    canConfirmMonth = computed(() => {
        if (!this.isSalaryInputTargetMonth() || this.isLoadingMonth() || this.isLoadingBonus()) {
            return false;
        }
        const status = this.monthRewardStatus();
        if (status === 'draft' || status === 'unregistered') return true;
        return this.draftBonusesInMonth().length > 0;
    });

    willConfirmRewardInMonth = computed(() => {
        const status = this.monthRewardStatus();
        return status === 'draft' || status === 'unregistered';
    });

    confirmMonthButtonLabel = computed(() => {
        if (this.willConfirmRewardInMonth()) return '報酬・賞与を確定';
        if (this.draftBonusesInMonth().length > 0) return '賞与を確定';
        return '確定';
    });

    hasDraftBonusesInMonth = computed(() => this.draftBonusesInMonth().length > 0);

    confirmMonthDialogMessage = computed(() => {
        const monthLabel = this.targetYearMonthLabel();
        if (this.willConfirmRewardInMonth()) {
            const bonusNote = this.hasDraftBonusesInMonth() ? '' : '賞与はありません。';
            return `${monthLabel}の報酬・賞与を確定します。${bonusNote}確定後は変更できません。よろしいですか？`;
        }
        return `${monthLabel}の賞与を確定します。確定後は変更できません。よろしいですか？`;
    });

    confirmedEmployeeBonuses = computed(() => confirmedBonuses(this.employeeBonuses()));

    // 月次報酬の登録済み報酬月額
    registeredMonthlyReward = computed(() => {
        const reward = this.standardReward();
        if (!reward) return null;
        if (this.isPartTimeEmployee()) {
            return partTimeInsuranceMonthlyRewardFromRecord(reward);
        }
        return this.sumRewardFields(reward);
    });

    // 対象月の報酬月額（手当合計。保存済みは DB、未保存はフォーム）
    targetMonthMonthlyReward = computed((): number | null => {
        // フォームの合計を更新
        this.formRewardRevision();

        const employee = this.employee();
        const payYearMonth = this.targetYearMonth();
        if (
            employee
            && payYearMonth
            && isJoinMonthWithNextMonthPay(employee, payYearMonth, this.payrollPaymentMonthOffset())
        ) {
            return 0;
        }

        const workYearMonth = this.workYearMonth();
        if (this.isLoadingMonth() || !workYearMonth) return null;

        const monthlyReward = effectiveMonthlyRewardFromBase(
            this.getMonthlyReward(),
            workYearMonth,
            this.confirmedEmployeeBonuses(),
        );

        const paymentBaseDays = this.paymentBaseDays();
        if (paymentBaseDays === null) return null;

        const daysInMonth = this.pageMode() === 'input' && payYearMonth
            ? resolveDaysInMonthForPayMonth(payYearMonth, this.payrollPaymentMonthOffset())
            : getDaysInMonth(workYearMonth);
        const resolved = resolveMonthlyRewardWithEnrollmentProration({
            employmentType: this.employee()?.employmentType ?? null,
            monthlyReward,
            paymentBaseDays,
            daysInMonth,
        });

        return resolved > 0 ? resolved : null;
    });

    // 社会保険加入判定の日本語表示（対象, 対象外, 判定不可）
    displayInsuranceStatus(insuranceStatus: insuranceJoinStatus): string {
        return insuranceJoinStatusLabel(insuranceStatus);
    }

    joinStatusSummary = computed((): string => {
        const parts = [
            `健保: ${this.displayInsuranceStatus(this.healthInsuranceJoinStatus())}`,
            `年金: ${this.displayInsuranceStatus(this.pensionInsuranceJoinStatus())}`,
            `介護: ${this.displayInsuranceStatus(this.careInsuranceJoinStatus())}`,
        ];
        return parts.join(' / ');
    });

    socialInsuranceJoinJudgmentContext = computed(() =>
        buildSocialInsuranceJoinJudgmentContext(
            this.employee(),
            this.socialInsuranceStatus(),
            this.office(),
        ),
    );

    // 健康保険(厚生年金)加入判定(active: 対象, inactive: 対象外, unknown: 判定不可)
    healthInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return resolveHealthInsuranceJoinStatus(
            this.healthInsuranceStatus(),
            this.socialInsuranceJoinJudgmentContext(),
        );
    });

    // 厚生年金加入判定(active: 対象, inactive: 対象外, unknown: 判定不可)
    pensionInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return resolvePensionInsuranceJoinStatus(
            this.pensionInsuranceStatus(),
            this.socialInsuranceJoinJudgmentContext(),
        );
    });

    isHealthPremiumMonth = computed((): boolean => {
        const employee = this.employee();
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!liabilityYearMonth) return false;
        return isHealthInsurancePremiumTargetMonth(
            liabilityYearMonth,
            this.resolvedQualificationDate(),
            this.healthInsuranceEndDate(),
            employee?.birthDate ?? null,
        );
    });

    isPensionPremiumMonth = computed((): boolean => {
        const employee = this.employee();
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!liabilityYearMonth) return false;
        const acquisitionDate = this.resolvedQualificationDate();
        return isPensionInsurancePremiumTargetMonth(
            liabilityYearMonth,
            acquisitionDate,
            this.healthInsuranceEndDate(),
            this.pensionInsuranceStartDate(),
            this.pensionInsuranceEndDate(),
            employee?.birthDate ?? null,
        );
    });

    isCarePremiumMonth = computed((): boolean => {
        const employee = this.employee();
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!employee || !liabilityYearMonth) return false;
        return isCareInsurancePremiumTargetMonth(
            liabilityYearMonth,
            this.resolvedQualificationDate(),
            this.healthInsuranceEndDate(),
            employee.birthDate,
        );
    });

    // 介護保険加入判定(active: 対象, inactive: 対象外, unknown: 判定不可)
    careInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        const employee = this.employee();
        const judgmentYearMonth = this.pageMode() === 'premium'
            ? this.premiumLiabilityYearMonth()
            : this.workYearMonth();
        if (!employee || !judgmentYearMonth) return 'unknown';
        return judgeCareInsuranceStatus(
            judgmentYearMonth,
            this.healthInsuranceStartDate(),
            this.healthInsuranceEndDate(),
            employee.birthDate,
        );
    });

    careInsuranceLiabilityJoinStatus = computed((): insuranceJoinStatus => {
        const employee = this.employee();
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!employee || !liabilityYearMonth) return 'unknown';
        return judgeCareInsuranceStatus(
            liabilityYearMonth,
            this.healthInsuranceStartDate(),
            this.healthInsuranceEndDate(),
            employee.birthDate,
        );
    });

    // 随時改定の判定（成立済みのものを表示）
    /** 対象月の支払基礎日数（資格取得日〜退職日ベース） */
    paymentBaseDays = computed((): number | null => {
        const employee = this.employee();
        const targetYearMonth = this.workYearMonth();
        if (!employee || !targetYearMonth) return null;
        if (!isRewardTargetMonth(employee, targetYearMonth)) return null;

        const qualificationDate = this.resolvedQualificationDate();
        if (!qualificationDate) return null;

        const days = this.pageMode() === 'input'
            ? getPaymentBaseDaysForPayMonth(
                this.targetYearMonth(),
                qualificationDate,
                employee.retiredDate,
                this.payrollPaymentMonthOffset(),
            )
            : getPaymentBaseDays(
                targetYearMonth,
                qualificationDate,
                employee.retiredDate,
            );
        return days > 0 ? days : null;
    });

    // 賞与支払届（届出単位: 1人1行・同月合算）
    bonusPaymentProcedure = signal<Procedure | null>(null);
    isCreatingBonusPaymentProcedure = signal(false);

    aggregatedMonthBonusPayment = computed(() => {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return null;
        return aggregateMonthlyBonusPayment(this.monthBonuses(), targetYearMonth);
    });

    confirmedAggregatedMonthBonusPayment = computed(() => {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return null;
        return aggregateConfirmedMonthlyBonusPayment(this.monthBonuses(), targetYearMonth);
    });

    /** 年4回以上の賞与算入時は賞与支払届の対象外 */
    showBonusPaymentProcedureSection = computed(
        () => this.monthBonuses().length > 0 && !this.treatBonusAsMonthlyRemuneration(),
    );

    bonusPaymentProcedureExists = computed(() => this.bonusPaymentProcedure() !== null);

    bonusPaymentProcedureStatus = computed((): ProcedureStatus => {
        return this.bonusPaymentProcedure()?.status ?? 'notStarted';
    });

    bonusPaymentProcedureDueDate = computed((): string => {
        const procedure = this.bonusPaymentProcedure();
        if (procedure?.dueDate) return procedure.dueDate;
        const aggregated = this.confirmedAggregatedMonthBonusPayment() ?? this.aggregatedMonthBonusPayment();
        if (!aggregated?.paymentDate) return '';
        return procedureDueDateFromOccurredDate(aggregated.paymentDate);
    });

    isBonusPaymentProcedureOverdue = computed((): boolean => {
        const dueDate = this.bonusPaymentProcedureDueDate();
        if (!dueDate) return false;
        return isProcedureOverdue(
            {
                status: this.bonusPaymentProcedureStatus(),
                dueDate,
            },
            todayDateString(),
        );
    });

    bonusPaymentProcedureNudgeSummary = computed((): string | null => {
        const aggregated = this.aggregatedMonthBonusPayment();
        if (!aggregated) return null;

        const suffix = formatProcedureNudgeDueOrSubmitted(
            this.bonusPaymentProcedureStatus(),
            this.bonusPaymentProcedureDueDate(),
        );
        const amountLabel = `${aggregated.bonusAmountTotal.toLocaleString()}円`;
        const base = aggregated.isAggregated
            ? `${amountLabel}（${aggregated.remark}）`
            : amountLabel;
        return suffix ? `${base} · ${suffix}` : base;
    });

    isSalaryInputTargetMonth(): boolean {
        const employee = this.employee();
        const payYearMonth = this.targetYearMonth();
        if (!employee || !payYearMonth) return true;
        return isSalaryPayMonthTarget(
            employee,
            payYearMonth,
            this.payrollPaymentMonthOffset(),
        );
    }

    salaryInputExcludedReason(): string | null {
        const employee = this.employee();
        const payYearMonth = this.targetYearMonth();
        if (!employee || !payYearMonth) return null;
        return salaryPayMonthTargetReason(
            employee,
            payYearMonth,
            this.payrollPaymentMonthOffset(),
        );
    }

    isTargetMonth(): boolean {
        const employee = this.employee();
        const yearMonth = this.targetYearMonth();
        if (!employee || !yearMonth) return true;
        if (this.pageMode() === 'input') {
            if (this.isSalaryInputTargetMonth()) return true;
            if (this.isJoinPayMonthView()) return true;
            return false;
        }
        return isRewardTargetMonth(employee, yearMonth);
    }

    targetMonthReason(): string | null {
        const employee = this.employee();
        const yearMonth = this.targetYearMonth();
        if (!employee || !yearMonth) return null;
        return rewardTargetMonthReason(employee, yearMonth);
    }

    isInputRequiredMonth(): boolean {
        const effective = this.effectiveStandard();
        const yearMonth = this.workYearMonth();
        if (!effective || !yearMonth) return true;
        if (effective.missingMonths.includes(yearMonth)) return true;
        if (effective.determinationType === 'initial' && effective.qualificationYearMonth === yearMonth) {
            return true;
        }
        if (effective.calculationMonths.includes(yearMonth)) return true;
        return false;
    }

    monthRewardStatusLabel(): string {
        switch (this.monthRewardStatus()) {
            case 'loading':
                return '確認中';
            case 'draft':
                return '下書き';
            case 'confirmed':
                return '確定';
            case 'unregistered':
                return '未登録';
            case 'excluded':
                return '対象外';
        }
    }

    monthRewardStatusDescription(): string {
        switch (this.monthRewardStatus()) {
            case 'loading':
                return 'この月の報酬情報を確認しています。';
            case 'draft':
                return '下書きとして保存されています。修正して下書き保存するか、画面下部の「報酬・賞与を確定」から確定してください。';
            case 'confirmed':
                return '確定済みです。';
            case 'unregistered':
                if (this.prefilledFromYearMonthLabel()) {
                    return `直近の登録済み（${this.prefilledFromYearMonthLabel()}）を参考表示しています。`;
                }
                if (this.isInputRequiredMonth()) {
                    return '標準報酬月額の算定に必要な月です。';
                }
                return '入力は任意です。';
            case 'excluded':
                return this.salaryInputExcludedReason() ?? 'この月は給与入力の対象外です。';
            default:
                return '';
        }
    }

    effectiveCalculationMonthsLabel(): string {
        const effective = this.effectiveStandard();
        if (!effective?.calculationMonths.length) return '—';
        return formatPayMonthListFromWorkMonths(
            effective.calculationMonths,
            this.payrollPaymentMonthOffset(),
        );
    }

    private formatYearMonthList(months: string[]): string {
        return formatPayMonthListFromWorkMonths(months, this.payrollPaymentMonthOffset());
    }

    // 初期処理
    async ngOnInit() {
        this.isLoading.set(true);
        this.errorMessage.set('');
        this.employeeId.set(this.route.snapshot.params['employeeId'] ?? '');
        this.pageMode.set(this.readPageModeFromRoute());

        const queryYearMonth = this.route.snapshot.queryParams['ym'] as string | undefined;
        const hasExplicitYearMonth = Boolean(queryYearMonth && /^\d{4}-\d{2}$/.test(queryYearMonth));

        if (this.redirectLegacyTabIfNeeded()) {
            this.isLoading.set(false);
            return;
        }

        this.resetBonusForm();

        try {
            await this.loadEmployee();
            if (this.employee()) {
                await this.loadCompany();
                await this.loadEmployeeRewards();

                const initialYearMonth = this.resolveInitialPayYearMonth(
                    hasExplicitYearMonth ? queryYearMonth! : null,
                );
                this.setTargetYearMonth(initialYearMonth);

                if (!hasExplicitYearMonth || initialYearMonth !== queryYearMonth) {
                    void this.router.navigate([], {
                        relativeTo: this.route,
                        queryParams: { ym: initialYearMonth },
                        queryParamsHandling: 'merge',
                        replaceUrl: true,
                    });
                }

                await Promise.all([this.loadSocialInsuranceStatus(), this.loadSalaryConditions()]);
                await Promise.all([
                    this.loadStandardReward(),
                    this.loadManualRates(),
                    this.loadMonthBonuses(),
                ]);
                await Promise.all([this.loadOffice(), this.loadCompany()]);
                await Promise.all([
                    this.loadQualificationProcedure(),
                    this.loadRegularDecisionProcedure(),
                    this.loadRevisionProcedure(),
                    this.loadBonusPaymentProcedure(),
                ]);
            }
        } finally {
            this.isLoading.set(false);
        }
    }

    // 従業員の読み込み
    async loadEmployee() {
        const employeeId = this.employeeId();
        if (!employeeId) return;

        const employee = await this.employeeService.getEmployeeById(employeeId);
        if (!employee) {
            this.errorMessage.set('従業員が見つかりませんでした');
            return;
        }
        this.employee.set(employee);
    }

    // 事業所の読み込み
    async loadOffice() {
        const employee = this.employee();
        const officeId = employee?.officeId;
        if (!officeId) return;

        const office = await this.officeService.getOfficeById(officeId);
        if (!office) {
            this.errorMessage.set('事業所が見つかりませんでした');
            return;
        }
        this.office.set(office);
    }

    async loadCompany() {
        const employee = this.employee();
        const companyId = employee?.companyId;
        if (!companyId) return;

        const company = await this.companyService.getCompanyById(companyId);
        if (!company) return;

        this.company.set(company);
        this.insurancePremiumCollectionTiming.set(APP_INSURANCE_PREMIUM_COLLECTION_TIMING);
    }

    // 社会保険情報の読み込み
    async loadSocialInsuranceStatus() {
        const employeeId = this.employeeId();
        if (!employeeId) return;

        // 社会保険情報を取得
        const status = await this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employeeId);
        this.socialInsuranceStatus.set(status);

        // 健康保険の資格取得日・喪失日を設定
        this.healthInsuranceStartDate.set(status?.healthInsuranceStartDate ?? null);
        this.healthInsuranceEndDate.set(status?.healthInsuranceEndDate ?? null);
        this.pensionInsuranceStartDate.set(status?.pensionInsuranceStartDate ?? null);
        this.pensionInsuranceEndDate.set(status?.pensionInsuranceEndDate ?? null);
        // 健康保険の加入状況を設定
        this.healthInsuranceStatus.set(status?.healthInsuranceStatus ?? null);
        // 厚生年金の加入状況を設定
        this.pensionInsuranceStatus.set(status?.pensionInsuranceStatus ?? null);
        // 介護保険の加入状況を設定
        this.careInsuranceStatus.set(status?.careInsuranceStatus ?? null);
    }

    // 月次報酬の読み込み
    async loadEmployeeRewards() {
        const employeeId = this.employeeId();
        if (!employeeId) return;

        const rewards = await this.rewardService.listByEmployee(employeeId);
        const map: Record<string, StandardMonthlyReward> = {};
        for (const reward of rewards) {
            map[reward.targetYearMonth] = reward;
        }
        this.employeeRewards.set(map);
    }

    async loadSalaryConditions(): Promise<void> {
        const employeeId = this.employeeId();
        if (!employeeId) return;

        const conditions = await this.salaryConditionService.listByEmployee(employeeId);
        this.salaryConditions.set(conditions);
    }

    async onTargetYearMonthChange(yearMonth: string) {
        if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return;

        const employee = this.employee();
        const effectiveYearMonth = employee
            ? (this.pageMode() === 'premium'
                ? clampNavigableYearMonth(employee, yearMonth, this.currentYearMonth(), {
                    scope: 'premium_view',
                    timing: this.insurancePremiumCollectionTiming(),
                    latestConfirmedWorkYearMonth: this.latestConfirmedWorkYearMonth(),
                })
                : clampRewardNavigationPayYearMonth(
                    employee,
                    yearMonth,
                    this.currentYearMonth(),
                    this.payrollPaymentMonthOffset(),
                ))
            : yearMonth;
        if (effectiveYearMonth === this.targetYearMonth()) return;

        this.setTargetYearMonth(effectiveYearMonth);
        this.standardReward.set(null);
        this.prefilledFromYearMonth.set(null);
        this.resetRewardFieldsKeepMonth();
        this.message.set('');
        this.errorMessage.set('');
        this.manualRateMessage.set('');
        this.manualRateErrorMessage.set('');

        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { ym: effectiveYearMonth },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });

        this.resetBonusForm();
        this.bonusMessage.set('');
        this.bonusErrorMessage.set('');

        this.isLoadingMonth.set(true);
        try {
            await Promise.all([
                this.loadStandardReward(),
                this.loadManualRates(),
                this.loadMonthBonuses(),
                this.loadQualificationProcedure(),
                this.loadRegularDecisionProcedure(),
                this.loadRevisionProcedure(),
                this.loadBonusPaymentProcedure(),
            ]);
        } finally {
            this.isLoadingMonth.set(false);
        }
    }

    async loadQualificationProcedure(): Promise<void> {
        this.qualificationProcedure.set(null);

        const employee = this.employee();
        if (!employee || !this.showQualificationProcedureSection()) return;

        try {
            const procedure = await this.procedureService.getQualificationProcedureByEmployeeId(
                employee.id,
                employee.companyId,
            );
            this.qualificationProcedure.set(procedure);
            await this.syncQualificationProcedureRewardIfNeeded();
        } catch (error) {
            console.error('資格取得届の取得に失敗しました', error);
            this.errorMessage.set('資格取得届の取得に失敗しました');
        }
    }

    private async syncQualificationProcedureRewardIfNeeded(): Promise<void> {
        const employee = this.employee();
        if (!employee || !this.showQualificationProcedureSection()) return;

        let procedure = this.qualificationProcedure();
        if (!procedure) return;
        if (procedure.status === 'completed') return;

        const { reward: joinReward, fromExpectedSalaryCondition } = resolveQualificationJoinMonthReward({
            joinedDate: employee.joinedDate,
            companyId: employee.companyId,
            employeeId: employee.id,
            employmentType: employee.employmentType,
            salaryConditions: this.salaryConditions(),
            rewardsByYearMonth: this.employeeRewards(),
            payrollPaymentMonthOffset: this.payrollPaymentMonthOffset(),
        });
        const monthlyReward = resolveQualificationMonthlyReward(
            employee.joinedDate,
            joinReward,
            this.confirmedEmployeeBonuses(),
            employee.employmentType,
            fromExpectedSalaryCondition,
        );

        try {
            const updated = await this.procedureService.syncQualificationProcedureRewardPreview(
                procedure,
                monthlyReward,
            );
            this.qualificationProcedure.set(updated);
        } catch (error) {
            console.error('資格取得届への報酬反映に失敗しました', error);
        }
    }

    async loadRegularDecisionProcedure(): Promise<void> {
        this.regularDecisionProcedure.set(null);

        const employee = this.employee();
        const targetYearMonth = this.regularDecisionTargetYearMonth();
        if (!employee || !targetYearMonth || !this.showRegularDecisionProcedureSection()) return;

        try {
            const procedure = await this.procedureService.getRegularDecisionProcedureByEmployeeIdAndTargetYearMonth(
                employee.id,
                employee.companyId,
                targetYearMonth,
            );
            this.regularDecisionProcedure.set(procedure);
        } catch (error) {
            console.error('算定基礎届の取得に失敗しました', error);
            this.errorMessage.set('算定基礎届の取得に失敗しました');
        }
    }

    async loadRevisionProcedure(): Promise<void> {
        this.revisionProceduresByApplyFrom.set({});

        const employee = this.employee();
        const contexts = this.revisionProcedureContexts();
        if (!employee || contexts.length === 0) return;

        try {
            const entries = await Promise.all(
                contexts.map(async (context) => {
                    const procedure =
                        await this.procedureService.getRevisionProcedureByEmployeeIdAndTargetYearMonth(
                employee.id,
                employee.companyId,
                context.applyFromMonth,
            );
                    return [context.applyFromMonth, procedure] as const;
                }),
            );
            this.revisionProceduresByApplyFrom.set(Object.fromEntries(entries));
        } catch (error) {
            console.error('月額変更届の取得に失敗しました', error);
            this.errorMessage.set('月額変更届の取得に失敗しました');
        }
    }

    async loadBonusPaymentProcedure(): Promise<void> {
        this.bonusPaymentProcedure.set(null);

        const employee = this.employee();
        const targetYearMonth = this.targetYearMonth();
        if (!employee || !targetYearMonth || !this.showBonusPaymentProcedureSection()) return;

        try {
            const procedure = await this.procedureService.getBonusPaymentProcedureByEmployeeIdAndTargetYearMonth(
                employee.id,
                employee.companyId,
                targetYearMonth,
            );
            this.bonusPaymentProcedure.set(procedure);
        } catch (error) {
            console.error('賞与支払届の取得に失敗しました', error);
            this.errorMessage.set('賞与支払届の取得に失敗しました');
        }
    }

    async shiftMonth(delta: number) {
        if ((delta < 0 && !this.canGoPrevMonth()) || (delta > 0 && !this.canGoNextMonth())) {
            return;
        }

        const current = this.targetYearMonth();
        if (!current) return;
    
        const nextMonth = addMonthsToYearMonth(current, delta);
        await this.onTargetYearMonthChange(nextMonth);
    }

    async goToOldestUnregisteredMonth(): Promise<void> {
        const oldest = this.oldestUnregisteredYearMonth();
        if (!oldest || oldest === this.targetYearMonth()) return;
        await this.onTargetYearMonthChange(oldest);
    }

    latestRegisteredReward(): StandardMonthlyReward | null {
        const ym = this.workYearMonth();
        if (!ym) return null;
        return findLatestRegisteredRewardBefore(ym, this.employeeRewards());
    }

    latestRegisteredYearMonthLabel(): string | null {
        const latest = this.latestRegisteredReward();
        if (!latest) return null;
        return formatPayYearMonthLabelFromWorkMonth(
            latest.targetYearMonth,
            this.payrollPaymentMonthOffset(),
        );
    }

    canCopyFromLatestRegistered(): boolean {
        return (
            Boolean(this.latestRegisteredReward())
            && this.isRewardEditable()
            && !this.isQualificationMonth()
        );
    }

    copyFromLatestRegistered() {
        const latest = this.latestRegisteredReward();
        if (!latest) {
            this.errorMessage.set('直近の登録済み報酬情報がありません');
            return;
        }
        this.errorMessage.set('');
        this.applyRewardToForm(latest);
        this.message.set(
            `${formatPayYearMonthLabelFromWorkMonth(latest.targetYearMonth, this.payrollPaymentMonthOffset())}支給分の報酬をコピーしました。変更箇所を修正して保存してください。`,
        );
    }

    prefilledFromYearMonthLabel(): string | null {
        const ym = this.prefilledFromYearMonth();
        if (!ym) return null;
        return formatPayYearMonthLabelFromWorkMonth(ym, this.payrollPaymentMonthOffset());
    }

    changedFixedWageFieldLabels(): string[] {
        const reward = this.standardReward();
        if (!reward?.changedFixedWageFields?.length) return [];
        return reward.changedFixedWageFields.map(
            (key) => FIXED_WAGE_FIELD_LABELS[key as FixedWageFieldKey] ?? key,
        );
    }

    previousMonthReward(): StandardMonthlyReward | null {
        const payYearMonth = this.workYearMonth();
        const employee = this.employee();
        if (!payYearMonth || !employee) return null;
        const joinYearMonth = yearMonthFromDateString(employee.joinedDate);
        return lookupRewardByPayMonth(
            this.employeeRewards(),
            addMonthsToYearMonth(payYearMonth, -1),
            this.payrollPaymentMonthOffset(),
            joinYearMonth,
        );
    }

    isFixedWageFieldChanged(key: FixedWageFieldKey): boolean {
        const previous = this.previousMonthReward();
        if (!previous) return false;
        return this.toNumber(this.rewardForm[key]) !== previous[key];
    }

    hasFixedWageChangesInForm(): boolean {
        return FIXED_WAGE_FIELD_KEYS.some((key) => this.isFixedWageFieldChanged(key));
    }

    previousFixedWageValue(key: FixedWageFieldKey): number | null {
        const previous = this.previousMonthReward();
        if (!previous || !this.isFixedWageFieldChanged(key)) return null;
        return previous[key];
    }

    onRewardFormFieldChange(): void {
        this.bumpFormRewardRevision();
    }

    rewardDetailLink(): string[] {
        const employeeId = this.employeeId();
        return employeeId ? ['/rewards', employeeId] : ['/rewards'];
    }

    premiumDetailLink(): string[] {
        const employeeId = this.employeeId();
        return employeeId ? ['/premium', employeeId] : ['/premium'];
    }

    crossPageQueryParams(): { ym?: string } {
        const ym = this.targetYearMonth();
        return ym ? { ym } : {};
    }

    private readPageModeFromRoute(): PremiumPageMode {
        return this.route.snapshot.data['premiumPageMode'] === 'premium' ? 'premium' : 'input';
    }

    private redirectLegacyTabIfNeeded(): boolean {
        const tab = this.route.snapshot.queryParams['tab'] as string | undefined;
        const employeeId = this.employeeId();
        if (!employeeId || !tab) return false;

        const ym = this.targetYearMonth();
        const queryParams = ym ? { ym } : {};

        if (tab === 'input' && this.pageMode() === 'premium') {
            void this.router.navigate(['/rewards', employeeId], {
                queryParams,
                replaceUrl: true,
            });
            return true;
        }
        if (tab === 'premium' && this.pageMode() === 'input') {
            void this.router.navigate(['/premium', employeeId], {
                queryParams,
                replaceUrl: true,
            });
            return true;
        }
        return false;
    }

    private setTargetYearMonth(yearMonth: string) {
        this.targetYearMonth.set(yearMonth);
        this.rewardForm.targetYearMonth = yearMonth;
    }

    private resolveInitialPayYearMonth(explicitYearMonth: string | null): string {
        const employee = this.employee();
        const referenceYearMonth = this.currentYearMonth();
        const fallback = explicitYearMonth ?? referenceYearMonth;

        if (!employee) return fallback;

        let candidate = fallback;
        if (!explicitYearMonth && this.pageMode() === 'input') {
            candidate = findEmployeeOldestUnregisteredPayYearMonth(
                employee,
                this.employeeRewards(),
                this.payrollPaymentMonthOffset(),
                referenceYearMonth,
            ) ?? fallback;
        }

        if (this.pageMode() === 'premium') {
            return clampNavigableYearMonth(
                employee,
                candidate,
                referenceYearMonth,
                {
                    scope: 'premium_view',
                    timing: this.insurancePremiumCollectionTiming(),
                    latestConfirmedWorkYearMonth: this.latestConfirmedWorkYearMonth(),
                },
            );
        }

        return clampRewardNavigationPayYearMonth(
            employee,
            candidate,
            referenceYearMonth,
            this.payrollPaymentMonthOffset(),
        );
    }

    private async fetchStandardRewardForPayMonth(
        employeeId: string,
        payYearMonth: string,
    ): Promise<StandardMonthlyReward | null> {
        return this.rewardService.getByEmployeeAndMonth(employeeId, payYearMonth);
    }

    async loadStandardReward() {
        const employeeId = this.employeeId();
        const payYearMonth = this.targetYearMonth();
        if (!employeeId || !payYearMonth) return;

        this.errorMessage.set('');
        try {
            const standardReward = await this.fetchStandardRewardForPayMonth(employeeId, payYearMonth);
            this.standardReward.set(standardReward);
            if (standardReward) {
                this.prefilledFromYearMonth.set(null);
                this.setFormFromStandardReward();
                const recordKey = rewardRecordKeyForPayMonth(payYearMonth);
                this.employeeRewards.update((current) => ({
                    ...current,
                    [recordKey]: {
                        ...standardReward,
                        targetYearMonth: recordKey,
                    },
                }));
            } else {
                const latest = findLatestRegisteredRewardBefore(
                    payYearMonth,
                    this.employeeRewards(),
                );
                if (latest) {
                    this.prefilledFromYearMonth.set(latest.targetYearMonth);
                    this.applyRewardToForm(latest);
                } else {
                    this.prefilledFromYearMonth.set(null);
                    this.resetRewardFieldsKeepMonth();
                }
            }
            this.applyActiveSalaryConditionToForm();
        } catch (error) {
            console.error('標準報酬月額の取得に失敗しました', error);
            this.errorMessage.set('標準報酬月額の取得に失敗しました');
        } finally {
            this.bumpFormRewardRevision();
        }
    }

    setFormFromStandardReward() {
        const standardReward = this.standardReward();
        if (!standardReward) return;
        this.applyRewardToForm(standardReward);
    }

    private applyRewardToForm(reward: StandardMonthlyReward) {
        const isPartTime = this.isPartTimeEmployee();
        this.rewardForm = {
            targetYearMonth: this.workYearMonth(),
            basicSalary: reward.basicSalary,
            commutingAllowance: reward.commutingAllowance,
            positionAllowance: isPartTime ? '' : reward.positionAllowance,
            housingAllowance: isPartTime ? '' : reward.housingAllowance,
            fixedOvertimePay: isPartTime ? '' : reward.fixedOvertimePay,
            otherFixedAllowance: isPartTime ? partTimeOtherAllowanceTotal(reward) : reward.otherFixedAllowance,
            overtimePay: isPartTime ? '' : reward.overtimePay,
            holidayPay: isPartTime ? '' : reward.holidayPay,
            nightPay: isPartTime ? '' : reward.nightPay,
            commissionPay: isPartTime ? '' : reward.commissionPay,
            otherVariablePay: isPartTime ? '' : reward.otherVariablePay,
        };
        this.showVariableWageFields.set(this.hasVariableWageValues());
        this.applyActiveSalaryConditionToForm();
    }

    private applyActiveSalaryConditionToForm(): void {
        const condition = this.activeSalaryConditionForMonth();
        if (!condition || this.isPartTimeEmployee()) return;

        const fixed = fixedWageFieldsFromSalaryCondition(condition);
        this.rewardForm = {
            ...this.rewardForm,
            basicSalary: fixed.basicSalary,
            commutingAllowance: fixed.commutingAllowance,
            positionAllowance: fixed.positionAllowance,
            housingAllowance: fixed.housingAllowance,
            fixedOvertimePay: fixed.fixedOvertimePay,
            otherFixedAllowance: fixed.otherFixedAllowance,
        };
    }

    private hasVariableWageValues(): boolean {
        const fields = [
            this.rewardForm.overtimePay,
            this.rewardForm.holidayPay,
            this.rewardForm.nightPay,
            this.rewardForm.commissionPay,
            this.rewardForm.otherVariablePay,
        ];
        return fields.some((value) => this.toNumber(value) > 0);
    }

    toggleVariableWageFields(): void {
        this.showVariableWageFields.update((visible) => !visible);
    }

    toggleFixedWageFields(): void {
        this.showFixedWageFields.update((visible) => !visible);
    }

    private resetRewardFieldsKeepMonth() {
        const ym = this.targetYearMonth();
        this.rewardForm = {
            targetYearMonth: ym,
            basicSalary: '',
            commutingAllowance: '',
            positionAllowance: '',
            housingAllowance: '',
            fixedOvertimePay: '',
            otherFixedAllowance: '',
            overtimePay: '',
            holidayPay: '',
            nightPay: '',
            commissionPay: '',
            otherVariablePay: '',
        };
        this.showVariableWageFields.set(false);
        this.showFixedWageFields.set(true);
    }

    hasRewardFormInput(): boolean {
        return this.rewardFormFields().some(
            (value) => value !== '' && value !== null && value !== undefined,
        );
    }

    private rewardFormFields(): RewardFormFieldValue[] {
        const form = this.rewardForm;
        return [
            form.basicSalary,
            form.commutingAllowance,
            form.positionAllowance,
            form.housingAllowance,
            form.fixedOvertimePay,
            form.otherFixedAllowance,
            form.overtimePay,
            form.holidayPay,
            form.nightPay,
            form.commissionPay,
            form.otherVariablePay,
        ];
    }

    getMonthlyReward(): number {
        if (this.isPartTimeEmployee()) {
            return this.getPartTimeMonthlyRewardTotal();
        }
        const form = this.rewardForm;
        return (
            this.toNumber(form.basicSalary) +
            this.toNumber(form.commutingAllowance) +
            this.toNumber(form.positionAllowance) +
            this.toNumber(form.housingAllowance) +
            this.toNumber(form.fixedOvertimePay) +
            this.toNumber(form.otherFixedAllowance) +
            this.toNumber(form.overtimePay) +
            this.toNumber(form.holidayPay) +
            this.toNumber(form.nightPay) +
            this.toNumber(form.commissionPay) +
            this.toNumber(form.otherVariablePay)
        );
    }

    /** パートの報酬月額（月額報酬＋通勤手当＋その他手当） */
    getPartTimeMonthlyRewardTotal(): number {
        const form = this.rewardForm;
        const basicSalary = this.isJoinMonthPartTimePayLocked()
            ? this.lockedPartTimeMonthlyPay()
            : this.toNumber(form.basicSalary);
        return partTimeMonthlyRewardTotal(
            basicSalary,
            this.toNumber(form.commutingAllowance),
            this.toNumber(form.otherFixedAllowance),
        );
    }

    getStandardMonthlyRewardCalculation(): StandardMonthlyRewardCalculation {
        return this.calculator.calculate(this.getMonthlyReward());
    }

    private toNumber(value: string | number | null | undefined): number {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const trimmed = String(value).trim();
        if (!trimmed) return 0;
        const num = Number(trimmed);
        return Number.isFinite(num) ? num : 0;
    }

    private sumRewardFields(reward: Pick<
        StandardMonthlyReward,
        | 'basicSalary'
        | 'commutingAllowance'
        | 'positionAllowance'
        | 'housingAllowance'
        | 'fixedOvertimePay'
        | 'otherFixedAllowance'
        | 'overtimePay'
        | 'holidayPay'
        | 'nightPay'
        | 'commissionPay'
        | 'otherVariablePay'
    >): number {
        return (
            reward.basicSalary +
            reward.commutingAllowance +
            reward.positionAllowance +
            reward.housingAllowance +
            reward.fixedOvertimePay +
            reward.otherFixedAllowance +
            reward.overtimePay +
            reward.holidayPay +
            reward.nightPay +
            reward.commissionPay +
            reward.otherVariablePay
        );
    }

    private buildInput(): StandardMonthlyRewardInput {
        const employee = this.employee();
        if (!employee?.companyId) {
            throw new Error('従業員の会社情報が取得できません');
        }

        const base = {
            companyId: employee.companyId,
            employeeId: this.employeeId(),
            targetYearMonth: rewardRecordKeyForPayMonth(this.targetYearMonth()),
            healthInsuranceGrade: 0,
            healthInsuranceStandardMonthlyAmount: 0,
            pensionInsuranceGrade: 0,
            pensionInsuranceStandardMonthlyAmount: 0,
        };

        if (this.isPartTimeEmployee()) {
            const basicSalary = this.isJoinMonthPartTimePayLocked()
                ? this.lockedPartTimeMonthlyPay()
                : this.toNumber(this.rewardForm.basicSalary);
            const commutingAllowance = this.toNumber(this.rewardForm.commutingAllowance);
            const otherFixedAllowance = this.toNumber(this.rewardForm.otherFixedAllowance);
            const monthlyRewardAmount = partTimeMonthlyRewardTotal(
                basicSalary,
                commutingAllowance,
                otherFixedAllowance,
            );
            return {
                ...base,
                basicSalary,
                commutingAllowance,
                positionAllowance: 0,
                housingAllowance: 0,
                fixedOvertimePay: 0,
                otherFixedAllowance,
                overtimePay: 0,
                holidayPay: 0,
                nightPay: 0,
                commissionPay: 0,
                otherVariablePay: 0,
                monthlyRewardAmount,
            };
        }

        return {
            ...base,
            ...this.resolveFixedWageFieldsForSave(),
            overtimePay: this.toNumber(this.rewardForm.overtimePay),
            holidayPay: this.toNumber(this.rewardForm.holidayPay),
            nightPay: this.toNumber(this.rewardForm.nightPay),
            commissionPay: this.toNumber(this.rewardForm.commissionPay),
            otherVariablePay: this.toNumber(this.rewardForm.otherVariablePay),
        };
    }

    private resolveFixedWageFieldsForSave(): Pick<
        StandardMonthlyRewardInput,
        FixedWageFieldKey
    > {
        const condition = this.activeSalaryConditionForMonth();
        if (condition && this.usesSalaryConditionForFixedWage()) {
            return fixedWageFieldsFromSalaryCondition(condition);
        }

        if (this.isJoinMonthFixedWageLocked()) {
            return this.lockedFixedWageFields();
        }

        return {
            basicSalary: this.toNumber(this.rewardForm.basicSalary),
            commutingAllowance: this.toNumber(this.rewardForm.commutingAllowance),
            positionAllowance: this.toNumber(this.rewardForm.positionAllowance),
            housingAllowance: this.toNumber(this.rewardForm.housingAllowance),
            fixedOvertimePay: this.toNumber(this.rewardForm.fixedOvertimePay),
            otherFixedAllowance: this.toNumber(this.rewardForm.otherFixedAllowance),
        };
    }

    private lockedFixedWageFields(): Pick<StandardMonthlyRewardInput, FixedWageFieldKey> {
        const saved = this.standardReward();
        if (saved) {
            return {
                basicSalary: saved.basicSalary,
                commutingAllowance: saved.commutingAllowance,
                positionAllowance: saved.positionAllowance,
                housingAllowance: saved.housingAllowance,
                fixedOvertimePay: saved.fixedOvertimePay,
                otherFixedAllowance: saved.otherFixedAllowance,
            };
        }

        return {
            basicSalary: this.toNumber(this.rewardForm.basicSalary),
            commutingAllowance: this.toNumber(this.rewardForm.commutingAllowance),
            positionAllowance: this.toNumber(this.rewardForm.positionAllowance),
            housingAllowance: this.toNumber(this.rewardForm.housingAllowance),
            fixedOvertimePay: this.toNumber(this.rewardForm.fixedOvertimePay),
            otherFixedAllowance: this.toNumber(this.rewardForm.otherFixedAllowance),
        };
    }

    private lockedPartTimeMonthlyPay(): number {
        const saved = this.standardReward();
        if (saved) return saved.basicSalary;
        return this.toNumber(this.rewardForm.basicSalary);
    }

    private buildPreviewRewardForTargetMonth(): StandardMonthlyReward | null {
        const employee = this.employee();
        const yearMonth = this.workYearMonth();
        const current = this.standardReward();
        if (!employee || !yearMonth || this.isLoadingMonth() || !this.isSalaryInputTargetMonth()) {
            return current && normalizeRewardStatus(current) === 'confirmed' ? current : null;
        }

        try {
            const input = this.buildInput();
            const monthlyTotal = this.isPartTimeEmployee()
                ? this.getPartTimeMonthlyRewardTotal()
                : this.sumRewardFields(input);
            if (monthlyTotal <= 0) {
                return current && normalizeRewardStatus(current) !== 'default' ? current : null;
            }

            const calc = this.calculator.calculate(monthlyTotal);
            if (!calc.health || !calc.pension) {
                return current && normalizeRewardStatus(current) !== 'default' ? current : null;
            }

            const { monthlyRewardAmount: _monthlyRewardAmount, ...rewardFields } = input;

            return {
                id: current?.id ?? '',
                ...rewardFields,
                monthlyReward: monthlyTotal,
                healthInsuranceGrade: calc.health.grade,
                healthInsuranceStandardMonthlyAmount: calc.health.standardMonthlyAmount,
                pensionInsuranceGrade: calc.pension.grade,
                pensionInsuranceStandardMonthlyAmount: calc.pension.standardMonthlyAmount,
                fixedWageChanged: current?.fixedWageChanged,
                changedFixedWageFields: current?.changedFixedWageFields,
                status: 'confirmed',
                createdAt: current?.createdAt ?? ({} as StandardMonthlyReward['createdAt']),
                updatedAt: current?.updatedAt ?? ({} as StandardMonthlyReward['updatedAt']),
            };
        } catch {
            return current && normalizeRewardStatus(current) !== 'default' ? current : null;
        }
    }

    private buildRewardsWithFormPreview(
        calculationYearMonth: string,
    ): Record<string, StandardMonthlyReward> {
        this.formRewardRevision();
        const activeWorkMonth = this.workYearMonth();
        const allRewards = this.employeeRewards();

        const rewards = { ...confirmedRewardsByYearMonth(allRewards) };
        delete rewards[calculationYearMonth];

        if (calculationYearMonth === activeWorkMonth) {
            const preview = this.buildPreviewRewardForTargetMonth();
            if (preview) {
                rewards[calculationYearMonth] = preview;
            }
        } else {
            const stored = allRewards[calculationYearMonth];
            if (stored && normalizeRewardStatus(stored) !== 'default') {
                rewards[calculationYearMonth] = stored;
            }
        }

        return rewards;
    }

    async saveDraftStandardMonthlyReward() {
        await this.persistStandardMonthlyReward('draft');
    }

    async confirmMonthCompensation() {
        if (!this.canConfirmMonth()) return;

        const confirmed = await this.confirmService.confirm(
            this.confirmMonthDialogMessage(),
            {
                confirmLabel: '確定する',
                cancelLabel: 'キャンセル',
            },
        );
        if (!confirmed) return;

        const monthStatus = this.monthRewardStatus();
        const confirmReward = monthStatus === 'draft' || monthStatus === 'unregistered';
        const bonusesToConfirm = this.draftBonusesInMonth();

        this.isConfirmingMonth.set(true);
        this.errorMessage.set('');
        this.message.set('');
        this.bonusErrorMessage.set('');
        this.bonusMessage.set('');

        try {
            if (confirmReward) {
                await this.persistStandardMonthlyReward('confirmed', {
                    quiet: true,
                    skipSavingFlag: true,
                });
            }
            for (const bonus of bonusesToConfirm) {
                await this.persistSavedBonusReward(bonus, { quiet: true, skipSavingFlag: true });
            }
            await this.loadMonthBonuses();
            await this.loadBonusPaymentProcedure();
            this.resetBonusForm();

            const liabilityMonths = new Set<string>();
            if (confirmReward) {
                const workYm = this.workYearMonth();
                if (workYm) liabilityMonths.add(workYm);
            }
            for (const bonus of bonusesToConfirm) {
                liabilityMonths.add(bonus.targetYearMonth);
            }
            await this.syncSavedPremiumResultsForLiabilityMonths([...liabilityMonths]);
            await this.syncQualificationProcedureRewardIfNeeded();

            const labels: string[] = [];
            if (confirmReward) {
                this.message.set(`${this.targetYearMonthLabel()}の報酬・賞与を確定しました`);
            } else if (bonusesToConfirm.length > 0) {
                this.message.set(`${this.targetYearMonthLabel()}の賞与を確定しました`);
            }
            // this.setActiveTab('premium');
        } catch (error) {
            console.error('確定に失敗しました', error);
            const msg = error instanceof Error ? error.message : '確定に失敗しました';
            this.errorMessage.set(msg);
        } finally {
            this.isConfirmingMonth.set(false);
        }
    }

    private async persistStandardMonthlyReward(
        mode: 'draft' | 'confirmed',
        options?: { quiet?: boolean; skipSavingFlag?: boolean },
    ) {
        const employeeId = this.employeeId();
        if (!employeeId) return;
        if (!this.targetYearMonth()) {
            this.errorMessage.set('支給年月を選択してください');
            return;
        }
        if (!this.isSalaryInputTargetMonth()) {
            this.errorMessage.set(
                this.salaryInputExcludedReason() ?? 'この月は給与入力の対象外です',
            );
            return;
        }
        if (mode === 'draft' && !this.isRewardEditable()) {
            this.errorMessage.set('確定済みのため変更できません');
            return;
        }

        if (!options?.skipSavingFlag) {
        this.isSaving.set(true);
        }
        this.errorMessage.set('');
        if (!options?.quiet) {
        this.message.set('');
        }

        try {
            const input = this.buildInput();
            const saved =
                mode === 'draft'
                    ? await this.rewardService.saveDraft(input)
                    : await this.rewardService.confirm(input);
            this.standardReward.set(saved);
            this.prefilledFromYearMonth.set(null);
            this.setFormFromStandardReward();
            this.employeeRewards.update((current) => ({
                ...current,
                [saved.targetYearMonth]: saved,
            }));
            await this.syncQualificationProcedureRewardIfNeeded();
            if (mode === 'confirmed') {
            await Promise.all([
                this.loadRegularDecisionProcedure(),
                this.loadRevisionProcedure(),
            ]);
            }
            if (!options?.quiet) {
                this.message.set(
                    mode === 'draft'
                        ? `${saved.targetYearMonth} の報酬情報を下書き保存しました`
                        : `${saved.targetYearMonth} の報酬情報を確定しました`,
                );
            }
        } catch (error) {
            console.error('保存に失敗しました', error);
            const msg = error instanceof Error ? error.message : '保存に失敗しました';
            if (!options?.quiet) {
                this.errorMessage.set(msg);
            }
            if (options?.skipSavingFlag) {
                throw error instanceof Error ? error : new Error(msg);
            }
            this.errorMessage.set(msg);
        } finally {
            if (!options?.skipSavingFlag) {
            this.isSaving.set(false);
            }
        }
    }

    private async syncSavedPremiumResultsForLiabilityMonths(liabilityYearMonths: string[]): Promise<void> {
        const employee = this.employee();
        const company = this.company();
        if (!employee || !company) return;

        const payYearMonths = new Set<string>();
        for (const liabilityYearMonth of liabilityYearMonths) {
            for (const payYearMonth of this.premiumCalculationService.payYearMonthsForLiabilityMonth(
                liabilityYearMonth,
                company.insurancePremiumCollectionTiming,
            )) {
                payYearMonths.add(payYearMonth);
            }
        }

        await Promise.all(
            [...payYearMonths].map((payYearMonth) => this.persistPremiumResultForPayMonth(payYearMonth)),
        );
    }

    private async persistPremiumResultForPayMonth(payYearMonth: string): Promise<void> {
        const employee = this.employee();
        const company = this.company();
        if (!employee || !company) return;

        const calculated = this.premiumCalculationService.calculateForPayMonth({
            employee,
            payYearMonth,
            collectionTiming: company.insurancePremiumCollectionTiming,
            rewardsByYearMonth: this.employeeRewards(),
            bonuses: this.confirmedEmployeeBonuses(),
            healthInsuranceStartDate: this.healthInsuranceStartDate(),
            healthInsuranceEndDate: this.healthInsuranceEndDate(),
            pensionInsuranceStartDate: this.pensionInsuranceStartDate(),
            pensionInsuranceEndDate: this.pensionInsuranceEndDate(),
            office: this.office(),
            manualRates: this.manualRates(),
            payrollPaymentMonthOffset: company.payrollPaymentMonthOffset ?? 1,
            salaryConditions: this.salaryConditions(),
            joinJudgmentContext: this.socialInsuranceJoinJudgmentContext(),
        });
        if (!calculated) return;

        await this.premiumResultService.save({
            companyId: employee.companyId,
            employeeId: employee.id,
            targetYearMonth: payYearMonth,
            ...calculated,
        });
    }

    private currentYearMonth(): string {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }

    // 健康保険料率（本人負担）
    healthInsuranceRate = computed((): number | null => {
        return this.resolvedPremiumRates()?.healthEmployeeRate ?? null;
    });

    healthInsuranceTotalRate = computed((): number | null => {
        return this.resolvedPremiumRates()?.healthTotalRate ?? null;
    });

    // 健康保険料率（会社負担）
    healthInsuranceEmployerRate = computed((): number | null => {
        return this.resolvedPremiumRates()?.healthEmployerRate ?? null;
    });

    // 介護保険料率（本人負担）
    careInsuranceRate = computed((): number | null => {
        return this.resolvedPremiumRates()?.careEmployeeRate ?? null;
    });

    careInsuranceTotalRate = computed((): number | null => {
        return this.resolvedPremiumRates()?.careTotalRate ?? null;
    });

    // 介護保険料率（会社負担）
    careInsuranceEmployerRate = computed((): number | null => {
        return this.resolvedPremiumRates()?.careEmployerRate ?? null;
    });

    /** この月に適用される健康保険の標準報酬月額（保存済み報酬のみ） */
    applicableHealthStandardAmount = computed((): number | null => {
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        this.standardReward();
        this.employeeRewards();
        if (this.isLoadingMonth() || !liabilityYearMonth) return null;
        if (!this.liabilityMonthHasConfirmedReward()) return null;

        const effective = this.effectiveStandardForPremium();
        if (!effective?.isComplete || !effective.calculation?.health) return null;
        return resolveMonthlyPremiumStandardAmounts(effective.calculation).health;
    });

    /** この月に適用される厚生年金の標準報酬月額（保存済み報酬のみ・年金表上限適用） */
    applicablePensionStandardAmount = computed((): number | null => {
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (this.isLoadingMonth() || !liabilityYearMonth) return null;
        if (!this.liabilityMonthHasConfirmedReward()) return null;

        const effective = this.effectiveStandardForPremium();
        if (!effective?.isComplete || !effective.calculation?.health) return null;
        return resolveMonthlyPremiumStandardAmounts(effective.calculation).pension;
    });

    hasMonthlyPremiumDisplay = computed((): boolean => {
        if (this.applicableHealthStandardAmount() === null && this.applicablePensionStandardAmount() === null) {
            return false;
        }
        return this.isHealthPremiumMonth() || this.isPensionPremiumMonth() || this.isCarePremiumMonth();
    });

    healthGrade = computed(() => this.effectiveStandardForPremium()?.calculation?.health?.grade ?? null);

    pensionGrade = computed(() => this.effectiveStandardForPremium()?.calculation?.pension?.grade ?? null);

    premiumDeterminationBadgeClass = computed(() => {
        const type = this.effectiveStandardForPremium()?.determinationType;
        if (type === 'initial') return 'initial';
        if (type === 'revision') return 'revision';
        return 'regular';
    });

    premiumEffectiveCalculationMonthsLabel = computed(() => {
        const effective = this.effectiveStandardForPremium();
        if (!effective?.calculationMonths.length) return '—';
        return this.formatYearMonthList(effective.calculationMonths);
    });

    displayRevisionApplyFromLabel = computed(() =>
        this.revisionApplyFromLabelFromEffective(this.effectiveStandard()),
    );

    premiumRevisionApplyFromLabel = computed(() =>
        this.revisionPremiumApplyFromLabelFromEffective(this.effectiveStandardForPremium()),
    );

    private revisionPremiumApplyFromLabelFromEffective(
        effective: EffectiveStandardRemuneration | null | undefined,
    ): string | null {
        if (effective?.determinationType !== 'revision' || !effective.calculationMonths.length) {
            return null;
        }
        const originMonth = effective.calculationMonths[0]!;
        const revisionApplyFromPayMonth = getRevisionApplyFromMonth(originMonth);
        const premiumDeductionFromPayMonth = resolvePremiumDeductionApplyFromPayMonth(
            revisionApplyFromPayMonth,
            this.insurancePremiumCollectionTiming(),
        );
        return formatRevisionApplyFromPayMonthLabel(
            premiumDeductionFromPayMonth,
            this.payrollPaymentMonthOffset(),
        );
    }

    private revisionApplyFromLabelFromEffective(
        effective: EffectiveStandardRemuneration | null | undefined,
    ): string | null {
        if (effective?.determinationType !== 'revision' || !effective.calculationMonths.length) {
            return null;
        }
        const lastCalculationMonth = effective.calculationMonths[effective.calculationMonths.length - 1]!;
        const applyFromWorkMonth = addMonthsToYearMonth(lastCalculationMonth, 1);
        return formatRevisionApplyFromPayMonthLabel(
            applyFromWorkMonth,
            this.payrollPaymentMonthOffset(),
        );
    }

    careTargetLabel = computed(() => (this.isCarePremiumMonth() ? '対象月' : '対象外'));

    careStatusLabel = computed(() => this.displayInsuranceStatus(this.careInsuranceLiabilityJoinStatus()));

    canShowPremiumSummary = computed(() => {
        if (this.isPremiumEnrollmentUndetermined()) return false;
        if (this.isJoinMonthZeroPremiumDeductionView()) return true;
        if (this.hasUndeterminedPremiumDueToMissingReward()) return true;
        if (this.hasMonthlyPremiumDisplay() || this.isMonthlyPremiumNotSubject()) {
            return true;
        }
        const bonusPremium = this.bonusSocialInsuranceEmployeePremium();
        return bonusPremium !== null && bonusPremium > 0;
    });

    healthPremiumAmountDisplay = computed((): InsurancePremiumAmountDisplay => {
        const resolved = this.resolvedPremiumRates();
        return this.premiumAmountDisplayWithManualRateHint(
            this.healthInsuranceJoinStatus(),
            this.isHealthPremiumMonth(),
            this.healthInsurancePremium(),
            resolved?.needsManualHealthRate ?? false,
            resolved?.healthEmployeeRate ?? null,
            '健康保険',
        );
    });

    pensionPremiumAmountDisplay = computed((): InsurancePremiumAmountDisplay => {
        const resolved = this.resolvedPremiumRates();
        return this.premiumAmountDisplayWithManualRateHint(
            this.pensionInsuranceJoinStatus(),
            this.isPensionPremiumMonth(),
            this.pensionInsurancePremium(),
            resolved?.needsManualPensionRate ?? false,
            resolved?.pensionEmployeeRate ?? null,
            '厚生年金',
        );
    });

    carePremiumAmountDisplay = computed((): InsurancePremiumAmountDisplay => {
        const resolved = this.resolvedPremiumRates();
        return this.premiumAmountDisplayWithManualRateHint(
            this.careInsuranceLiabilityJoinStatus(),
            this.isCarePremiumMonth(),
            this.careInsurancePremium(),
            resolved?.needsManualCareRate ?? false,
            resolved?.careEmployeeRate ?? null,
            '介護保険',
        );
    });

    private premiumAmountDisplayWithManualRateHint(
        joinStatus: insuranceJoinStatus,
        isPremiumMonth: boolean,
        premium: number | null,
        needsManualRate: boolean,
        rate: number | null,
        label: string,
    ): InsurancePremiumAmountDisplay {
        if (
            this.hasUndeterminedPremiumDueToMissingReward()
            && isPremiumMonth
            && joinStatus === 'active'
        ) {
            const label = this.premiumUndeterminedRewardMonthLabel();
            return {
                kind: 'undetermined',
                message: label
                    ? `${label}の給与を入力してください。`
                    : '給与を入力してください。',
            };
        }
        if (
            needsManualRate
            && isPremiumMonth
            && joinStatus === 'active'
            && rate === null
        ) {
            return {
                kind: 'undetermined',
                message: `${label}の料率データがありません。手動で入力してください。`,
            };
        }
        return this.resolvePremiumAmountDisplay(joinStatus, isPremiumMonth, premium);
    }

    hasUndeterminedPremiumDueToMissingManualRates = computed((): boolean => {
        if (!this.liabilityMonthHasConfirmedReward() || this.isPremiumEnrollmentUndetermined()) {
            return false;
        }
        const resolved = this.resolvedPremiumRates();
        if (!resolved) return false;
        return (
            this.isInsurancePremiumBlockedByMissingManualRate(
                resolved.needsManualHealthRate,
                this.healthInsuranceJoinStatus(),
                this.isHealthPremiumMonth(),
                resolved.healthEmployeeRate,
            )
            || this.isInsurancePremiumBlockedByMissingManualRate(
                resolved.needsManualPensionRate,
                this.pensionInsuranceJoinStatus(),
                this.isPensionPremiumMonth(),
                resolved.pensionEmployeeRate,
            )
            || this.isInsurancePremiumBlockedByMissingManualRate(
                resolved.needsManualCareRate,
                this.careInsuranceLiabilityJoinStatus(),
                this.isCarePremiumMonth(),
                resolved.careEmployeeRate,
            )
        );
    });

    private isInsurancePremiumBlockedByMissingManualRate(
        needsManualRate: boolean,
        joinStatus: insuranceJoinStatus,
        isPremiumMonth: boolean,
        rate: number | null,
    ): boolean {
        return needsManualRate && joinStatus === 'active' && isPremiumMonth && rate === null;
    }

    private resolvePremiumAmountDisplay(
        joinStatus: insuranceJoinStatus,
        isPremiumMonth: boolean,
        premium: number | null,
    ): InsurancePremiumAmountDisplay {
        return resolveInsurancePremiumAmountDisplay({
            joinStatus,
            isPremiumMonth,
            premium,
            enrollmentUndetermined: this.isPremiumEnrollmentUndetermined(),
            liabilityRewardConfirmed: this.liabilityMonthHasConfirmedReward(),
        });
    }

    hasCalculatedPremium(premium: number | null | undefined): premium is number {
        return premium !== null && premium !== undefined;
    }

    // 健康保険料
    healthInsurancePremiumShares = computed((): InsurancePremiumShares | null => {
        if (!this.isHealthPremiumMonth()) return null;
        return this.calculatePremiumShares(
            this.applicableHealthStandardAmount(),
            this.healthInsuranceTotalRate(),
        );
    });

    healthInsurancePremium = computed((): number | null => {
        return this.healthInsurancePremiumShares()?.employeePremium ?? null;
    });

    healthInsuranceEmployerPremium = computed((): number | null => {
        return this.healthInsurancePremiumShares()?.employerPremium ?? null;
    });

    healthInsuranceTotalPremium = computed((): number | null => {
        return this.healthInsurancePremiumShares()?.totalPremium ?? null;
    });

    // 厚生年金料率
    pensionInsuranceRate = computed((): number | null => {
        return this.resolvedPremiumRates()?.pensionEmployeeRate ?? null;
    });

    pensionInsuranceTotalRate = computed((): number | null => {
        return this.resolvedPremiumRates()?.pensionTotalRate ?? null;
    });

    pensionInsuranceEmployerRate = computed((): number | null => {
        return this.resolvedPremiumRates()?.pensionEmployerRate ?? null;
    });

    pensionInsurancePremiumShares = computed((): InsurancePremiumShares | null => {
        if (!this.isPensionPremiumMonth()) return null;
        return this.calculatePremiumShares(
            this.applicablePensionStandardAmount(),
            this.pensionInsuranceTotalRate(),
        );
    });

    pensionInsurancePremium = computed((): number | null => {
        return this.pensionInsurancePremiumShares()?.employeePremium ?? null;
    });

    pensionInsuranceEmployerPremium = computed((): number | null => {
        return this.pensionInsurancePremiumShares()?.employerPremium ?? null;
    });

    pensionInsuranceTotalPremium = computed((): number | null => {
        return this.pensionInsurancePremiumShares()?.totalPremium ?? null;
    });

    // 介護保険料
    careInsurancePremiumShares = computed((): InsurancePremiumShares | null => {
        if (!this.isCarePremiumMonth()) return null;
        return this.calculatePremiumShares(
            this.applicableHealthStandardAmount(),
            this.careInsuranceTotalRate(),
        );
    });

    careInsurancePremium = computed((): number | null => {
        return this.careInsurancePremiumShares()?.employeePremium ?? null;
    });

    careInsuranceEmployerPremium = computed((): number | null => {
        return this.careInsurancePremiumShares()?.employerPremium ?? null;
    });

    careInsuranceTotalPremium = computed((): number | null => {
        return this.careInsurancePremiumShares()?.totalPremium ?? null;
    });

    // 社会保険料の合計（本人負担）
    socialInsurancePremium = computed((): number | null => {
        if (this.hasUndeterminedPremiumDueToMissingReward()) return null;
        if (this.hasUndeterminedPremiumDueToMissingManualRates()) return null;
        const healthPremium = this.healthInsurancePremium() ?? 0;
        const pensionPremium = this.pensionInsurancePremium() ?? 0;
        const carePremium = this.careInsurancePremium() ?? 0;
        return healthPremium + pensionPremium + carePremium;
    });

    // 社会保険料の合計（会社負担）
    socialInsuranceEmployerPremium = computed((): number | null => {
        if (this.hasUndeterminedPremiumDueToMissingReward()) return null;
        if (this.hasUndeterminedPremiumDueToMissingManualRates()) return null;
        const healthPremium = this.healthInsuranceEmployerPremium() ?? 0;
        const pensionPremium = this.pensionInsuranceEmployerPremium() ?? 0;
        const carePremium = this.careInsuranceEmployerPremium() ?? 0;
        return healthPremium + pensionPremium + carePremium;
    });

    bonusSocialInsuranceEmployeePremium = computed((): number | null => {
        const breakdown = this.bonusInsurancePremiumBreakdown();
        if (breakdown.health === null && breakdown.pension === null && breakdown.care === null) {
            return null;
        }
        return (breakdown.health ?? 0) + (breakdown.pension ?? 0) + (breakdown.care ?? 0);
    });

    bonusSocialInsuranceEmployerPremium = computed((): number | null => {
        const breakdown = this.bonusInsuranceEmployerPremiumBreakdown();
        if (breakdown.health === null && breakdown.pension === null && breakdown.care === null) {
            return null;
        }
        return (breakdown.health ?? 0) + (breakdown.pension ?? 0) + (breakdown.care ?? 0);
    });

    bonusInsurancePremiumBreakdown = computed(() => this.calculateBonusInsurancePremiumBreakdown(false));

    bonusInsuranceEmployerPremiumBreakdown = computed(() =>
        this.calculateBonusInsurancePremiumBreakdown(true),
    );

    bonusHealthInsurancePremium = computed(() => this.bonusInsurancePremiumBreakdown().health);

    bonusPensionInsurancePremium = computed(() => this.bonusInsurancePremiumBreakdown().pension);

    bonusCareInsurancePremium = computed(() => this.bonusInsurancePremiumBreakdown().care);

    bonusHealthInsuranceEmployerPremium = computed(
        () => this.bonusInsuranceEmployerPremiumBreakdown().health,
    );

    bonusPensionInsuranceEmployerPremium = computed(
        () => this.bonusInsuranceEmployerPremiumBreakdown().pension,
    );

    bonusCareInsuranceEmployerPremium = computed(() => this.bonusInsuranceEmployerPremiumBreakdown().care);

    bonusPremiumableStandardAmounts = computed(() => {
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const monthBonuses = this.bonusesForPremium();
        if (!liabilityYearMonth || monthBonuses.length === 0) return null;
        return resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth,
            monthBonuses,
            allBonuses: this.confirmedEmployeeBonuses(),
        });
    });

    canShowBonusPremiumCards = computed(
        () =>
            !this.treatBonusAsMonthlyRemuneration()
            && this.liabilityMonthHasConfirmedReward()
            && this.bonusesForPremium().length > 0,
    );

    bonusHealthCarePremiumableStandardAmount = computed((): number | null => {
        if (!this.canShowBonusPremiumCards()) return null;
        return this.bonusPremiumableStandardAmounts()?.healthAndCare ?? null;
    });

    bonusPensionPremiumableStandardAmount = computed((): number | null => {
        if (!this.canShowBonusPremiumCards()) return null;
        return this.bonusPremiumableStandardAmounts()?.pension ?? null;
    });

    bonusHealthInsuranceTotalPremium = computed((): number | null => {
        if (!this.canShowBonusPremiumCards() || !this.isHealthPremiumMonth()) return null;
        return this.calculatePremiumShares(
            this.bonusHealthCarePremiumableStandardAmount(),
            this.healthInsuranceTotalRate(),
        )?.totalPremium ?? null;
    });

    bonusPensionInsuranceTotalPremium = computed((): number | null => {
        if (!this.canShowBonusPremiumCards() || !this.isPensionPremiumMonth()) return null;
        return this.calculatePremiumShares(
            this.bonusPensionPremiumableStandardAmount(),
            this.pensionInsuranceTotalRate(),
        )?.totalPremium ?? null;
    });

    bonusCareInsuranceTotalPremium = computed((): number | null => {
        if (!this.canShowBonusPremiumCards() || !this.isCarePremiumMonth()) return null;
        return this.calculatePremiumShares(
            this.bonusHealthCarePremiumableStandardAmount(),
            this.careInsuranceTotalRate(),
        )?.totalPremium ?? null;
    });

    totalEmployerPremium = computed((): number | null => {
        const monthly = this.socialInsuranceEmployerPremium();
        const bonus = this.bonusSocialInsuranceEmployerPremium();
        if (monthly === null && bonus === null) return null;
        return (monthly ?? 0) + (bonus ?? 0);
    });

    // 賞与を取得
    async loadMonthBonuses() {
        const employee = this.employee();
        const employeeId = this.employeeId();
        const targetYearMonth = this.targetYearMonth();
        if (!employee?.companyId || !employeeId || !targetYearMonth) return;

        this.isLoadingBonus.set(true);
        try {
            const all = await this.bonusRewardService.getBonusRewardsByEmployee(
                employee.companyId,
                employeeId,
            );
            this.employeeBonuses.set(all);
            const filtered = all
                .filter((bonus) => bonus.targetYearMonth === targetYearMonth)
                .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
            this.monthBonuses.set(filtered);
        } catch (error) {
            console.error('賞与の取得に失敗しました', error);
            this.bonusErrorMessage.set('賞与の取得に失敗しました');
        } finally {
            this.isLoadingBonus.set(false);
            this.syncBonusFormVisibility();
        }
    }

    private syncBonusFormVisibility(): void {
        if (this.monthBonuses().length === 0 && this.isTargetMonth()) {
            this.isBonusFormVisible.set(true);
        } else if (!this.isTargetMonth()) {
            this.isBonusFormVisible.set(false);
        }
    }

    bonusPaymentDateMin = computed((): string | null => {
        const employee = this.employee();
        const targetYearMonth = this.targetYearMonth();
        if (!employee || !targetYearMonth) return null;

        return resolveBonusPaymentDateBounds({
            employee,
            targetYearMonth,
            healthInsuranceStartDate: this.healthInsuranceStartDate(),
            healthInsuranceEndDate: this.healthInsuranceEndDate(),
            monthEndDate: this.lastDayOfTargetYearMonth(),
        }).min;
    });

    bonusPaymentDateMax = computed((): string | null => {
        const employee = this.employee();
        const targetYearMonth = this.targetYearMonth();
        if (!employee || !targetYearMonth) return null;

        return resolveBonusPaymentDateBounds({
            employee,
            targetYearMonth,
            healthInsuranceStartDate: this.healthInsuranceStartDate(),
            healthInsuranceEndDate: this.healthInsuranceEndDate(),
            monthEndDate: this.lastDayOfTargetYearMonth(),
        }).max;
    });

    editingBonus = computed((): BonusReward | null => {
        const paymentDate = this.bonusForm.paymentDate.trim();
        if (!paymentDate) return null;
        return this.monthBonuses().find((bonus) => bonus.paymentDate === paymentDate) ?? null;
    });

    isBonusFormEditable = computed(() => {
        if (!this.isBonusFormVisible() || !this.canManageBonuses()) return false;
        const editing = this.editingBonus();
        if (!editing) return this.isBonusEditable();
        return isBonusDraft(editing);
    });

    bonusStatusLabel(bonus: BonusReward): string {
        return normalizeBonusStatus(bonus) === 'draft' ? '下書き' : '確定';
    }

    canSelectBonusForEdit(bonus: BonusReward): boolean {
        return isBonusDraft(bonus);
    }

    selectBonusForEdit(bonus: BonusReward) {
        if (!this.isBonusEditable() || !this.canSelectBonusForEdit(bonus)) return;
        this.bonusForm = {
            paymentDate: bonus.paymentDate,
            bonusAmount: bonus.bonusAmount,
        };
        this.bonusErrorMessage.set('');
        this.bonusMessage.set('');
        this.isBonusFormVisible.set(true);
    }

    openNewBonusForm() {
        if (!this.isBonusEditable()) return;
        this.resetBonusForm();
        this.bonusErrorMessage.set('');
        this.bonusMessage.set('');
        this.isBonusFormVisible.set(true);
    }

    hideBonusForm() {
        this.isBonusFormVisible.set(false);
    }

    resetBonusForm() {
        this.bonusForm = {
            paymentDate: this.defaultBonusPaymentDate(),
            bonusAmount: '',
        };
    }

    // 賞与の支給日を取得
    private defaultBonusPaymentDate(excludePaymentDate?: string | null): string {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return '';

        const min = this.bonusPaymentDateMin();
        const max = this.bonusPaymentDateMax();
        const usedPaymentDates = this.monthBonuses()
            .map((bonus) => bonus.paymentDate)
            .filter((paymentDate) => paymentDate !== excludePaymentDate?.trim());

        return resolveDefaultBonusPaymentDate({
            targetYearMonth,
            minDate: min,
            maxDate: max,
            usedPaymentDates,
        });
    }

    private lastDayOfTargetYearMonth(): string {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return '';
        const [year, month] = targetYearMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        return `${targetYearMonth}-${String(lastDay).padStart(2, '0')}`;
    }

    // 賞与を保存（下書き）
    async saveBonusReward() {
        await this.persistBonusReward('draft');
    }

    async deleteDraftBonus(bonus: BonusReward, event?: Event) {
        event?.preventDefault();
        event?.stopPropagation();
        if (!this.isBonusEditable() || !isBonusDraft(bonus)) return;

        const confirmed = await this.confirmService.confirm(
            `${bonus.paymentDate}の賞与（下書き）を削除しますか？`,
            {
                confirmLabel: '削除',
                cancelLabel: 'キャンセル',
                danger: true,
            },
        );
        if (!confirmed) return;

        this.isDeletingBonus.set(true);
        this.bonusErrorMessage.set('');
        this.bonusMessage.set('');

        try {
            await this.bonusRewardService.deleteDraftBonusReward(bonus.id);
            if (this.editingBonus()?.paymentDate === bonus.paymentDate) {
                this.hideBonusForm();
                this.resetBonusForm();
            }
            await this.loadMonthBonuses();
            await this.loadBonusPaymentProcedure();
            this.bonusMessage.set('下書きの賞与を削除しました');
        } catch (error) {
            console.error('賞与の削除に失敗しました', error);
            const msg = error instanceof Error ? error.message : '賞与の削除に失敗しました';
            this.bonusErrorMessage.set(msg);
        } finally {
            this.isDeletingBonus.set(false);
        }
    }

    private async persistSavedBonusReward(
        bonus: BonusReward,
        options?: { quiet?: boolean; skipSavingFlag?: boolean },
    ) {
        const input = {
            companyId: bonus.companyId,
            employeeId: bonus.employeeId,
            paymentDate: bonus.paymentDate,
            targetYearMonth: bonus.targetYearMonth,
            bonusAmount: bonus.bonusAmount,
        };
        if (!options?.skipSavingFlag) {
            this.isSavingBonus.set(true);
        }
        try {
            await this.bonusRewardService.confirm(input);
            if (!options?.quiet) {
                this.bonusMessage.set('賞与を確定しました');
            }
        } catch (error) {
            console.error('賞与の確定に失敗しました', error);
            const msg = error instanceof Error ? error.message : '賞与の確定に失敗しました';
            this.bonusErrorMessage.set(msg);
            throw error;
        } finally {
            if (!options?.skipSavingFlag) {
                this.isSavingBonus.set(false);
            }
        }
    }

    private async persistBonusReward(mode: 'draft' | 'confirmed') {
        const employee = this.employee();
        const employeeId = this.employeeId();
        const targetYearMonth = this.targetYearMonth();
        if (!employee?.companyId || !employeeId || !targetYearMonth) return;

        if (!this.isTargetMonth()) {
            this.bonusErrorMessage.set(this.targetMonthReason() ?? 'この月は賞与登録の対象外です。');
            return;
        }
        if (mode === 'draft' && !this.isBonusEditable()) {
            this.bonusErrorMessage.set('確定済みのため変更できません');
            return;
        }

        const paymentDate = this.bonusForm.paymentDate.trim();
        const bonusAmount = this.toNumber(this.bonusForm.bonusAmount);

        this.bonusErrorMessage.set('');
        this.bonusMessage.set('');

        if (!paymentDate) {
            this.bonusErrorMessage.set('支給日を入力してください');
            return;
        }
        if (!paymentDate.startsWith(targetYearMonth)) {
            this.bonusErrorMessage.set('支給日は対象年月（' + this.targetYearMonthLabel() + '）の日付にしてください');
            return;
        }
        const periodReason = bonusPaymentDateReason(employee, paymentDate, {
            healthInsuranceStartDate: this.healthInsuranceStartDate(),
            healthInsuranceEndDate: this.healthInsuranceEndDate(),
        });
        if (periodReason) {
            this.bonusErrorMessage.set(periodReason);
            return;
        }
        if (bonusAmount <= 0) {
            this.bonusErrorMessage.set('賞与額を入力してください');
            return;
        }

        const editingPaymentDate = this.isEditingBonus() ? this.bonusForm.paymentDate.trim() : null;
        const duplicateReason = validateBonusPaymentDateDuplicate({
            paymentDate,
            monthBonuses: this.monthBonuses(),
            editingPaymentDate,
        });
        if (duplicateReason) {
            this.bonusErrorMessage.set(duplicateReason);
            return;
        }

        const wasNewBonus = !this.isEditingBonus();
        this.isSavingBonus.set(true);
        try {
            const input = {
                companyId: employee.companyId,
                employeeId,
                paymentDate,
                targetYearMonth,
                bonusAmount,
            };
            if (mode === 'draft') {
                await this.bonusRewardService.saveDraft(input);
            } else {
                await this.bonusRewardService.confirm(input);
            }
            await this.loadMonthBonuses();
            await this.loadBonusPaymentProcedure();
            this.bonusMessage.set(
                mode === 'draft' ? '賞与を下書き保存しました' : '賞与を確定しました',
            );
            if (mode === 'draft' && wasNewBonus) {
                this.openNewBonusForm();
            } else if (mode === 'confirmed') {
                this.resetBonusForm();
                this.isBonusFormVisible.set(false);
                await this.syncSavedPremiumResultsForLiabilityMonths([targetYearMonth]);
            }
        } catch (error) {
            console.error('賞与の保存に失敗しました', error);
            const msg = error instanceof Error ? error.message : '賞与の保存に失敗しました';
            this.bonusErrorMessage.set(msg);
        } finally {
            this.isSavingBonus.set(false);
        }
    }

    // 賞与を編集
    isEditingBonus(): boolean {
        const paymentDate = this.bonusForm.paymentDate;
        if (!paymentDate) return false;
        return this.monthBonuses().some((bonus) => bonus.paymentDate === paymentDate);
    }

    // 賞与の標準賞与額を取得
    getPreviewStandardBonusAmount(): number | null {
        const amount = this.toNumber(this.bonusForm.bonusAmount);
        if (amount <= 0) return null;
        return this.bonusRewardService.calculateStandardBonusAmount(amount);
    }

    // 社会保険料の合計（本人負担）
    socialInsuranceTotalPremium = computed((): number | null => {
        const monthly = this.socialInsurancePremium();
        if (monthly === null) return null;
        const bonus = this.bonusSocialInsuranceEmployeePremium();
        return monthly + (bonus ?? 0);
    });

    insuranceRatePercentLabel(rate: number | null): string | null {
        if (rate === null) return null;
        return Number((rate * 100).toFixed(3)).toString();
    }

    employeeInitial(employee: Employee): string {
        const initial =
            (employee.lastName?.[0] ?? '') + (employee.firstName?.[0] ?? '');
        return initial || '?';
    }

    updateManualRateFormField<K extends keyof ManualInsurancePremiumRateForm>(
        field: K,
        value: ManualInsurancePremiumRateForm[K],
    ): void {
        this.manualRateForm.update((form) => ({ ...form, [field]: value }));
        this.manualRateMessage.set('');
        this.manualRateErrorMessage.set('');
    }

    dismissManualRatesUnsetModal(): void {
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (liabilityYearMonth) {
            this.manualRatesUnsetModalDismissedFor.set(liabilityYearMonth);
        }
    }

    async loadManualRates(): Promise<void> {
        const employee = this.employee();
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!employee || !liabilityYearMonth) {
            this.manualRates.set(null);
            this.manualRateForm.set({ ...EMPTY_MANUAL_INSURANCE_PREMIUM_RATE_FORM });
            return;
        }

        try {
            const saved = await this.manualRateService.getByEmployeeAndLiabilityMonth(
                employee.id,
                liabilityYearMonth,
            );
            this.manualRates.set(saved);
            this.manualRateForm.set(this.buildManualRateForm(saved));
        } catch (error) {
            console.error('手動料率の取得に失敗しました', error);
            this.manualRates.set(null);
            this.manualRateForm.set({ ...EMPTY_MANUAL_INSURANCE_PREMIUM_RATE_FORM });
            this.manualRateErrorMessage.set('手動料率の取得に失敗しました');
        }
    }

    async saveManualRates(): Promise<void> {
        if (this.isSavingManualRates()) return;

        const employee = this.employee();
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const resolved = this.resolvedPremiumRates();
        if (!employee || !liabilityYearMonth || !resolved) return;

        const form = this.manualRateForm();
        const validationError = this.validateManualRateForm(resolved, form);
        if (validationError) {
            this.manualRateErrorMessage.set(validationError);
            return;
        }

        const health = manualRatePairFromPercent(form.healthRatePercent);
        const care = manualRatePairFromPercent(form.careRatePercent);
        const pension = manualRatePairFromPercent(form.pensionRatePercent);

        this.isSavingManualRates.set(true);
        this.manualRateErrorMessage.set('');
        this.manualRateMessage.set('');

        try {
            const saved = await this.manualRateService.save({
                companyId: employee.companyId,
                employeeId: employee.id,
                liabilityYearMonth,
                healthEmployeeRate: resolved.needsManualHealthRate ? health.employeeRate : null,
                healthEmployerRate: resolved.needsManualHealthRate ? health.employerRate : null,
                careEmployeeRate: resolved.needsManualCareRate ? care.employeeRate : null,
                careEmployerRate: resolved.needsManualCareRate ? care.employerRate : null,
                pensionEmployeeRate: resolved.needsManualPensionRate ? pension.employeeRate : null,
                pensionEmployerRate: resolved.needsManualPensionRate ? pension.employerRate : null,
            });
            this.manualRates.set(saved);
            this.manualRateForm.set(this.buildManualRateForm(saved));
            this.manualRateMessage.set(`${this.premiumLiabilityYearMonthLabel()}分の料率を保存しました`);

            const payYearMonth = this.targetYearMonth();
            if (payYearMonth) {
                await this.persistPremiumResultForPayMonth(payYearMonth);
            }
        } catch (error) {
            console.error('手動料率の保存に失敗しました', error);
            this.manualRateErrorMessage.set('手動料率の保存に失敗しました');
        } finally {
            this.isSavingManualRates.set(false);
        }
    }

    private buildManualRateForm(saved: ManualInsurancePremiumRates | null): ManualInsurancePremiumRateForm {
        if (!saved) return { ...EMPTY_MANUAL_INSURANCE_PREMIUM_RATE_FORM };
        return {
            healthRatePercent: savedRateToPercentInput(saved.healthEmployeeRate, saved.healthEmployerRate),
            careRatePercent: savedRateToPercentInput(saved.careEmployeeRate, saved.careEmployerRate),
            pensionRatePercent: savedRateToPercentInput(saved.pensionEmployeeRate, saved.pensionEmployerRate),
        };
    }

    private validateManualRateForm(
        resolved: NonNullable<ReturnType<typeof this.resolvedPremiumRates>>,
        form: ManualInsurancePremiumRateForm,
    ): string | null {
        if (resolved.needsManualHealthRate && percentInputToDecimalRate(form.healthRatePercent) === null) {
            return '健康保険の料率を入力してください';
        }
        if (resolved.needsManualCareRate && percentInputToDecimalRate(form.careRatePercent) === null) {
            return '介護保険の料率を入力してください';
        }
        if (resolved.needsManualPensionRate && percentInputToDecimalRate(form.pensionRatePercent) === null) {
            return '厚生年金の料率を入力してください';
        }
        return null;
    }

    private calculateBonusInsurancePremiumBreakdown(employer: boolean): {
        health: number | null;
        pension: number | null;
        care: number | null;
    } {
        if (!this.liabilityMonthHasConfirmedReward()) {
            return { health: null, pension: null, care: null };
        }

        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const bonuses = this.bonusesForPremium();
        if (!liabilityYearMonth || bonuses.length === 0) {
            return { health: null, pension: null, care: null };
        }

        const hasBonusAmount = bonuses.some((bonus) => bonus.standardBonusAmount > 0);
        if (!hasBonusAmount) {
            return { health: null, pension: null, care: null };
        }

        const amounts = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth,
            monthBonuses: bonuses,
            allBonuses: this.confirmedEmployeeBonuses(),
        });

        const healthShares = this.isHealthPremiumMonth()
            ? this.calculatePremiumShares(amounts.healthAndCare, this.healthInsuranceTotalRate())
            : null;
        const pensionShares = this.isPensionPremiumMonth()
            ? this.calculatePremiumShares(amounts.pension, this.pensionInsuranceTotalRate())
            : null;
        const careShares = this.isCarePremiumMonth()
            ? this.calculatePremiumShares(amounts.healthAndCare, this.careInsuranceTotalRate())
            : null;

        return {
            health: employer ? healthShares?.employerPremium ?? null : healthShares?.employeePremium ?? null,
            pension: employer ? pensionShares?.employerPremium ?? null : pensionShares?.employeePremium ?? null,
            care: employer ? careShares?.employerPremium ?? null : careShares?.employeePremium ?? null,
        };
    }

    private calculatePremiumShares(
        amount: number | null,
        totalRate: number | null,
    ): InsurancePremiumShares | null {
        const targetYearMonth = this.targetYearMonth();
        this.formRewardRevision();
        this.standardReward();
        this.employeeRewards();
        if (this.isLoadingMonth() || !targetYearMonth) return null;
        if (amount === null || totalRate === null) return null;

        return calculateInsurancePremiumShares(amount, totalRate);
    }

    private bumpFormRewardRevision(): void {
        this.formRewardRevision.update((v) => v + 1);
    }

    openSalaryConditionChangeModal(): void {
        const workYearMonth = this.workYearMonth();
        const existing = workYearMonth
            ? this.salaryConditions().find((item) => item.effectiveStartMonth === workYearMonth)
            : null;

        if (existing) {
            this.salaryConditionEditingMonth.set(existing.effectiveStartMonth);
            this.salaryConditionModalInitial.set(formValueFromSalaryCondition(existing));
        } else {
            this.salaryConditionEditingMonth.set(null);
            const previous = this.activeSalaryConditionForMonth();
            this.salaryConditionModalInitial.set({
                effectiveStartMonth: workYearMonth,
                basicSalary: previous?.basicSalary ?? '',
                commutingAllowance: previous?.commutingAllowance ?? 0,
                positionAllowance: previous?.positionAllowance ?? 0,
                housingAllowance: previous?.housingAllowance ?? 0,
                fixedOvertimePay: previous?.fixedOvertimePay ?? 0,
                otherFixedAllowance: previous?.otherFixedAllowance ?? 0,
                note: '',
                changeReason: '',
            });
        }

        this.salaryConditionSaveError.set('');
        this.showSalaryConditionModal.set(true);
    }

    openSalaryConditionHistoryModal(): void {
        this.showSalaryConditionHistoryModal.set(true);
    }

    closeSalaryConditionModal(): void {
        this.showSalaryConditionModal.set(false);
        this.salaryConditionSaveError.set('');
    }

    closeSalaryConditionHistoryModal(): void {
        this.showSalaryConditionHistoryModal.set(false);
    }

    async saveSalaryCondition(form: SalaryConditionFormValue): Promise<void> {
        const employee = this.employee();
        if (!employee) return;

        const validationError = validateSalaryConditionForm({
            form,
            employee,
            conditions: this.salaryConditions(),
            confirmedRewardMonths: this.confirmedRewardMonths(),
            editingEffectiveStartMonth: this.salaryConditionEditingMonth(),
            qualificationDate: this.resolvedQualificationDate(),
        });
        if (validationError) {
            this.salaryConditionSaveError.set(validationError);
            return;
        }

        this.isSavingSalaryCondition.set(true);
        this.salaryConditionSaveError.set('');

        try {
            const input = salaryConditionInputFromForm(form, {
                companyId: employee.companyId,
                employeeId: employee.id,
            });
            const saved = await this.salaryConditionService.save(input);
            const allConditions = await this.salaryConditionService.listByEmployee(employee.id);
            this.salaryConditions.set(allConditions);
            await this.syncDraftRewardsAfterSalaryConditionSave(saved, allConditions);
            this.closeSalaryConditionModal();
            await this.loadStandardReward();
            this.bumpFormRewardRevision();
        } catch (error) {
            console.error('給与条件の保存に失敗しました', error);
            this.salaryConditionSaveError.set('給与条件の保存に失敗しました');
        } finally {
            this.isSavingSalaryCondition.set(false);
        }
    }

    private async syncDraftRewardsAfterSalaryConditionSave(
        savedCondition: SalaryCondition,
        allConditions: SalaryCondition[],
    ): Promise<void> {
        const employee = this.employee();
        if (!employee) return;

        const maxYearMonth = inputableYearMonthMax(employee, this.currentYearMonth());
        const months = listRewardMonthsToSyncFromSalaryCondition({
            employee,
            savedCondition,
            allConditions,
            rewardsByYearMonth: this.employeeRewards(),
            maxYearMonth,
        });

        for (const targetYearMonth of months) {
            const condition = resolveSalaryConditionForMonth(allConditions, targetYearMonth);
            if (!condition) continue;

            const existing = this.employeeRewards()[targetYearMonth] ?? null;
            const input = buildSalaryConditionRewardDraftInput({
                employee,
                targetYearMonth,
                condition,
                existing,
                triggersRevision: savedCondition.triggersRevision
                    && targetYearMonth === savedCondition.effectiveStartMonth,
            });
            await this.rewardService.saveDraft(input);
        }

        await this.loadEmployeeRewards();
    }

    async openBonusPaymentProcedure(): Promise<void> {
        const employee = this.employee();
        const targetYearMonth = this.targetYearMonth();
        const aggregated = this.confirmedAggregatedMonthBonusPayment();
        if (!employee || !targetYearMonth || !aggregated || this.isCreatingBonusPaymentProcedure()) return;
        if (this.treatBonusAsMonthlyRemuneration()) return;

        const existing = this.bonusPaymentProcedure();
        if (existing) {
            this.router.navigate(['/procedures', existing.id]);
            return;
        }

        this.isCreatingBonusPaymentProcedure.set(true);
        this.errorMessage.set('');

        try {
            const procedure = await this.procedureService.createProcedure({
                companyId: employee.companyId,
                officeId: employee.officeId,
                employeeId: employee.id,
                procedureType: 'bonusPayment',
                status: 'notStarted',
                occurredDate: aggregated.paymentDate,
                dueDate: procedureDueDateFromOccurredDate(aggregated.paymentDate),
                completedDate: null,
                submittedDate: null,
                targetYearMonth,
                memo: aggregated.remark,
                lossReason: null,
                dependentChanges: null,
            });
            this.bonusPaymentProcedure.set(procedure);
            this.router.navigate(['/procedures', procedure.id]);
        } catch (error) {
            console.error('賞与支払届の作成に失敗しました', error);
            this.errorMessage.set('賞与支払届の作成に失敗しました');
        } finally {
            this.isCreatingBonusPaymentProcedure.set(false);
        }
    }

    async openRevisionProcedure(applyFromMonth: string): Promise<void> {
        const employee = this.employee();
        const context = this.revisionProcedureContexts().find(
            (item) => item.applyFromMonth === applyFromMonth,
        );
        if (!employee || !context || this.isCreatingRevisionProcedureFor(applyFromMonth)) return;

        const existing = this.revisionProceduresByApplyFrom()[applyFromMonth];
        if (existing) {
            this.router.navigate(['/procedures', existing.id]);
            return;
        }

        this.creatingRevisionApplyFrom.set(applyFromMonth);
        this.errorMessage.set('');

        try {
            const [lastYear, lastMonth] = context.lastCalculationMonth.split('-').map(Number);
            const lastDay = new Date(lastYear, lastMonth, 0).getDate();
            const occurredDate = `${lastYear}-${String(lastMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const procedure = await this.procedureService.createProcedure({
                companyId: employee.companyId,
                officeId: employee.officeId,
                employeeId: employee.id,
                procedureType: 'revision',
                status: 'notStarted',
                occurredDate,
                dueDate: '',
                completedDate: null,
                submittedDate: null,
                targetYearMonth: context.applyFromMonth,
                memo: '',
                lossReason: null,
                dependentChanges: null,
            });
            this.revisionProceduresByApplyFrom.update((current) => ({
                ...current,
                [applyFromMonth]: procedure,
            }));
            this.router.navigate(['/procedures', procedure.id]);
        } catch (error) {
            console.error('月額変更届の作成に失敗しました', error);
            this.errorMessage.set('月額変更届の作成に失敗しました');
        } finally {
            this.creatingRevisionApplyFrom.set(null);
        }
    }

    async openQualificationProcedure(): Promise<void> {
        const employee = this.employee();
        if (!employee || !this.isHealthInsuranceEligible() || this.isCreatingQualificationProcedure()) {
            return;
        }

        const existing = this.qualificationProcedure();
        if (existing) {
            this.router.navigate(['/procedures', existing.id]);
            return;
        }

        this.isCreatingQualificationProcedure.set(true);
        this.errorMessage.set('');

        try {
            const status = this.socialInsuranceStatus();
            const procedure = await this.procedureService.syncQualificationProcedureForEmployee({
                employee,
                healthInsuranceStartDate: status?.healthInsuranceStartDate ?? null,
                healthInsuranceStatus: status?.healthInsuranceStatus,
                pensionInsuranceStatus: status?.pensionInsuranceStatus,
            });
            if (!procedure) {
                this.errorMessage.set('資格取得届を作成できませんでした');
                return;
            }
            this.qualificationProcedure.set(procedure);
            this.router.navigate(['/procedures', procedure.id]);
        } catch (error) {
            console.error('資格取得届の作成に失敗しました', error);
            this.errorMessage.set('資格取得届の作成に失敗しました');
        } finally {
            this.isCreatingQualificationProcedure.set(false);
        }
    }

    async openRegularDecisionProcedure(): Promise<void> {
        const employee = this.employee();
        const targetYearMonth = this.regularDecisionTargetYearMonth();
        if (!employee || !targetYearMonth || this.isCreatingRegularDecisionProcedure()) return;

        if (this.revisionSupersedesRegularDecision()) {
            this.errorMessage.set('随時改定が成立しているため、算定基礎届は不要です。');
            return;
        }

        const existing = this.regularDecisionProcedure();
        if (existing) {
            this.router.navigate(['/procedures', existing.id]);
            return;
        }

        this.isCreatingRegularDecisionProcedure.set(true);
        this.errorMessage.set('');

        try {
            const procedure = await this.procedureService.createProcedure({
                companyId: employee.companyId,
                officeId: employee.officeId,
                employeeId: employee.id,
                procedureType: 'regularDecision',
                status: 'notStarted',
                occurredDate: `${targetYearMonth.slice(0, 4)}-06-30`,
                dueDate: regularDecisionProcedureDueDate(targetYearMonth),
                completedDate: null,
                submittedDate: null,
                targetYearMonth,
                memo: '',
                lossReason: null,
                dependentChanges: null,
            });
            this.regularDecisionProcedure.set(procedure);
            this.router.navigate(['/procedures', procedure.id]);
        } catch (error) {
            console.error('算定基礎届の作成に失敗しました', error);
            this.errorMessage.set('算定基礎届の作成に失敗しました');
        } finally {
            this.isCreatingRegularDecisionProcedure.set(false);
        }
    }
}
