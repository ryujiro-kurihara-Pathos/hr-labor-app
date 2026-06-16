import { Component, signal, inject, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

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
import { StandardRemunerationDeterminationService } from '../services/standard-remuneration-determination.service';
import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import {
    addMonthsToYearMonth,
    isRewardTargetMonth,
    rewardTargetMonthReason,
    navigableYearMonthMax,
    viewableYearMonthMin,
    yearMonthFromDateString,
} from '../utils/reward-target-month.util';
import {
    FIXED_WAGE_FIELD_KEYS,
    FIXED_WAGE_FIELD_LABELS,
    FixedWageFieldKey,
} from '../utils/fixed-wage-change.util';
import { findLatestRegisteredRewardBefore } from '../utils/latest-reward.util';
import { confirmedRewardsByYearMonth, normalizeRewardStatus, savedRewardsForPremiumCalculation } from '../utils/reward-status.util';
import {
    formatYearMonthLabel,
    getFirstRegularDeterminationYearMonth,
    getPaymentBaseDays,
    getQualificationDate,
} from '../utils/standard-remuneration-determination.util';
import {
    evaluateRevisionAtOrigin,
    formatRevisionGradeComparison,
} from '../utils/determination-precedence.util';
import { Office } from '../../company/models/office.model';
import { Company, InsurancePremiumCollectionTiming } from '../../company/models/company.model';
import { CompanyService } from '../../company/services/company.service';
import { formatPayrollDeductionNote, formatPremiumCollectionSummary, resolvePremiumLiabilityYearMonth } from '../../company/utils/company-payroll-settings.util';
import { OfficeService } from '../../company/services/office.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { resolveOfficePrefecture } from '../../company/utils/office-prefecture.util';
import { findCareInsuranceRate, findHealthInsuranceRate } from '../../insurance-rate/utils/insurance-rate-lookup.util';
import { KYOKAI_HEALTH_INSURANCE_RATE_FILES } from '../../insurance-rate/data/insurance-rates';
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
} from '../../social-insurance/utils/social-insurance-join-status.util';
import {
    isHealthInsurancePremiumTargetMonth,
    isPensionInsurancePremiumTargetMonth,
} from '../../social-insurance/utils/age-premium-period.util';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import {
    confirmedBonuses,
    isBonusDraft,
    normalizeBonusStatus,
} from '../../bonus/utils/bonus-status.util';
import {
    bonusesForStandardBonusPremium,
    effectiveMonthlyRewardFromBase,
    monthlyBonusRemunerationAddition,
    shouldTreatBonusAsMonthlyRemuneration,
    sumBonusAmountInTargetPeriod,
} from '../utils/effective-monthly-reward.util';
import { resolveBonusPremiumableStandardAmounts } from '../utils/bonus-standard-amount-cap.util';
import { roundInsurancePremium } from '../utils/insurance-premium-rounding.util';
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
import { Procedure, ProcedureStatus } from '../../social-insurance/models/procedures.model';
import { procedureStatusLabel } from '../../social-insurance/utils/procedure-display.util';
import { isPartTimeEmployment } from '../../social-insurance/utils/part-time-insurance-judgment.util';
import {
    getDaysInMonth,
    resolveMonthlyRewardWithEnrollmentProration,
} from '../utils/monthly-reward-proration.util';
import {
    partTimeInsuranceMonthlyRewardFromRecord,
    partTimeMonthlyRewardTotal,
    partTimeOtherAllowanceTotal,
} from '../utils/part-time-reward.util';
import { FieldHelpTooltipComponent } from '../../../shared/components/field-help-tooltip.component';

type MonthRewardStatus = 'loading' | 'draft' | 'confirmed' | 'unregistered' | 'excluded';
type PremiumDetailTab = 'input' | 'premium';

@Component({
    selector: 'app-insurance-premium-detail-page',
    standalone: true,
    imports: [FormsModule, DecimalPipe, RouterLink, FieldHelpTooltipComponent],
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
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly employeeService = inject(EmployeeService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly officeService = inject(OfficeService);
    private readonly companyService = inject(CompanyService);
    private readonly bonusRewardService = inject(BonusRewardService);
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly premiumResultService = inject(InsurancePremiumResultService);
    private readonly premiumCalculationService = inject(InsurancePremiumCalculationService);
    private readonly confirmService = inject(ConfirmService);

    readonly premiumStandardAmountHelpLines = [
        '標準報酬月額は、資格取得時・定時決定・随時改定のルールに基づき決まります。',
        '算定に必要な月の報酬を保存すると、保険料を表示します。',
    ];

    readonly premiumCalculationHelpLines = [
        '保険料 ＝ 標準報酬月額（または標準賞与額）× 料率（端数処理あり）です。',
        '健保料率は事業所の都道府県に応じた協会けんぽ料率を使用します。',
        '保存済みの報酬・賞与をもとに、徴収タイミング（当月／翌月）に応じて表示します。',
        '対象外の月や未加入の保険は「—」と表示します。',
    ];

    readonly payrollDeductionHelpLines = [
        '表示中の年月は、給与から控除する月です。',
        '翌月徴収の場合、4月分の保険料は5月の給与から控除され、4月の画面では月次保険料は0円です。',
        '当月徴収の場合、対象月の給与から控除されます。',
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
    isConfirmingMonth = signal(false);
    isLoadingBonus = signal(false);
    isSavingBonus = signal(false);
    isDeletingBonus = signal(false);
    // メッセージ
    errorMessage = signal<string>('');
    message = signal<string>('');
    bonusMessage = signal<string>('');
    bonusErrorMessage = signal<string>('');

    // 従業員
    employeeId = signal<string>('');
    employee = signal<Employee | null>(null);

    isPartTimeEmployee = computed(() => isPartTimeEmployment(this.employee()?.employmentType ?? null));

    // 事業所
    office = signal<Office | null>(null);
    company = signal<Company | null>(null);
    insurancePremiumCollectionTiming = signal<InsurancePremiumCollectionTiming>('next_month');
    // 対象年月
    targetYearMonth = signal<string>('');
    targetYearMonthLabel = computed(() => formatYearMonthLabel(this.targetYearMonth()));
    activeTab = signal<PremiumDetailTab>('input');

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

    isNextMonthCollection = computed(
        () => this.insurancePremiumCollectionTiming() === 'next_month',
    );

    viewableMinYearMonth = computed(() => {
        const employee = this.employee();
        return employee ? viewableYearMonthMin(employee) : null;
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
        const retireYm = navigableYearMonthMax(employee);
        if (!retireYm) return true;
        return ym < retireYm;
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

        if (!this.liabilityMonthHasConfirmedReward()) {
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

        if (
            this.isNextMonthCollection()
            && joinYearMonth
            && liabilityYearMonth
            && liabilityYearMonth < joinYearMonth
        ) {
            const nextPayLabel = formatYearMonthLabel(
                addMonthsToYearMonth(this.targetYearMonth(), 1),
            );
            return `この月の給与から控除する保険料はありません。${nextPayLabel}を選ぶと、${this.targetYearMonthLabel()}の報酬に基づく保険料が表示されます。`;
        }

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

    isRegularDecisionBaseMonth = computed((): boolean => {
        const yearMonth = this.targetYearMonth();
        if (!/^\d{4}-\d{2}$/.test(yearMonth)) return false;
        const month = Number(yearMonth.slice(5, 7));
        return month >= 4 && month <= 6;
    });

    regularDecisionYearLabel = computed((): string => {
        const yearMonth = this.targetYearMonth();
        if (!yearMonth) return '';
        return `${yearMonth.slice(0, 4)}年`;
    });

    /** 算定基礎届の対象年月キー（YYYY-06） */
    regularDecisionTargetYearMonth = computed((): string | null => {
        const yearMonth = this.targetYearMonth();
        if (!this.isRegularDecisionBaseMonth()) return null;
        return `${yearMonth.slice(0, 4)}-06`;
    });

    regularDecisionProcedureExists = computed(() => this.regularDecisionProcedure() !== null);

    regularDecisionProcedureStatus = computed((): ProcedureStatus => {
        return this.regularDecisionProcedure()?.status ?? 'notStarted';
    });

    /** 表示中の月が属する随時改定の算定3か月（固定的賃金変更月から） */
    revisionProcedureContext = computed(() => {
        const yearMonth = this.targetYearMonth();
        const employee = this.employee();
        if (!yearMonth || !employee || !isRewardTargetMonth(employee, yearMonth)) return null;

        const rewards = confirmedRewardsByYearMonth(this.employeeRewards());

        for (let offset = 0; offset <= 2; offset++) {
            const originMonth = addMonthsToYearMonth(yearMonth, -offset);
            const originReward = rewards[originMonth];
            if (!originReward?.fixedWageChanged) continue;

            const calculationMonths = [
                originMonth,
                addMonthsToYearMonth(originMonth, 1),
                addMonthsToYearMonth(originMonth, 2),
            ];
            if (!calculationMonths.includes(yearMonth)) continue;

            const applyFromMonth = addMonthsToYearMonth(originMonth, 3);
            const lastCalculationMonth = calculationMonths[2]!;

            return {
                originMonth,
                applyFromMonth,
                calculationMonths,
                lastCalculationMonth,
                windowLabel: `${formatYearMonthLabel(calculationMonths[0]!)}〜${formatYearMonthLabel(lastCalculationMonth)}`,
                applyFromLabel: formatYearMonthLabel(applyFromMonth),
                description: `${formatYearMonthLabel(calculationMonths[0]!)}〜${formatYearMonthLabel(lastCalculationMonth)}の報酬をもとに、${formatYearMonthLabel(applyFromMonth)}から随時改定の対象になるか判定します。`,
            };
        }

        return null;
    });

    showRevisionProcedureSection = computed(() => this.revisionProcedureContext() !== null);

    /** 算定基礎届と重なる月は月額変更届を優先 */
    showRegularDecisionProcedureSection = computed(
        () => this.isRegularDecisionBaseMonth() && !this.showRevisionProcedureSection(),
    );

    revisionProcedure = signal<Procedure | null>(null);
    isCreatingRevisionProcedure = signal(false);

    revisionProcedureExists = computed(() => this.revisionProcedure() !== null);

    revisionProcedureStatus = computed((): ProcedureStatus => {
        return this.revisionProcedure()?.status ?? 'notStarted';
    });

    /** 未入力月を開いたとき、初期表示に使った直近登録済み月（YYYY-MM） */
    prefilledFromYearMonth = signal<string | null>(null);
    /** 未保存のフォーム合計を computed に反映するためのトリガ */
    private formRewardRevision = signal(0);

    // 月次報酬の算定結果
    effectiveStandard = computed(() => {
        const employee = this.employee();
        const yearMonth = this.targetYearMonth();
        if (!employee || !yearMonth) return null;
        return this.determinationService.resolve(
            employee,
            this.rewardsForDisplayMonthCalculation(),
            yearMonth,
            this.healthInsuranceStartDate(),
            this.confirmedEmployeeBonuses(),
        );
    });

    /** 報酬パネル用。表示中の月のフォーム入力を算定に反映する */
    private rewardsForDisplayMonthCalculation = computed((): Record<string, StandardMonthlyReward> => {
        const yearMonth = this.targetYearMonth();
        if (!yearMonth) return confirmedRewardsByYearMonth(this.employeeRewards());
        return this.buildRewardsWithFormPreview(yearMonth);
    });

    effectiveStandardForPremium = computed(() => {
        const employee = this.employee();
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!employee || !liabilityYearMonth) return null;
        return this.determinationService.resolve(
            employee,
            savedRewardsForPremiumCalculation(this.employeeRewards()),
            liabilityYearMonth,
            this.healthInsuranceStartDate(),
            this.confirmedEmployeeBonuses(),
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
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!liabilityYearMonth) return false;
        const reward = this.employeeRewards()[liabilityYearMonth];
        return normalizeRewardStatus(reward) === 'confirmed';
    });

    /** 根拠月が健保・年金・介護のいずれかの保険料対象月か */
    isAnyLiabilityPremiumMonth = computed((): boolean => {
        return this.isHealthPremiumMonth()
            || this.isPensionPremiumMonth()
            || this.isCarePremiumMonth();
    });

    /** 翌月徴収で、対象月の給与控除として月次保険料が0円となる場合 */
    showZeroMonthlyPremiumDueToCollectionTiming = computed((): boolean => {
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
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!liabilityYearMonth) return [];
        const bonusesInLiabilityMonth = this.confirmedEmployeeBonuses().filter(
            (bonus) => bonus.targetYearMonth === liabilityYearMonth,
        );
        return bonusesForStandardBonusPremium(
            bonusesInLiabilityMonth,
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

    // 月次報酬のステータス
    monthRewardStatus = computed((): MonthRewardStatus => {
        if (this.isLoadingMonth()) return 'loading';
        const employee = this.employee();
        const yearMonth = this.targetYearMonth();
        if (!employee || !yearMonth) return 'unregistered';
        if (!isRewardTargetMonth(employee, yearMonth)) return 'excluded';

        const status = normalizeRewardStatus(this.standardReward());
        if (status === 'draft') return 'draft';
        if (status === 'confirmed') return 'confirmed';
        return 'unregistered';
    });

    /** 下書き・未登録のみ編集可能（確定後は変更不可） */
    isRewardEditable = computed(() => {
        const status = this.monthRewardStatus();
        return status === 'unregistered' || status === 'draft';
    });

    draftBonusesInMonth = computed(() =>
        this.monthBonuses().filter((bonus) => isBonusDraft(bonus)),
    );

    canConfirmMonth = computed(() => {
        if (!this.isTargetMonth() || this.isLoadingMonth() || this.isLoadingBonus()) {
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

        // 対象月を取得
        const targetYearMonth = this.targetYearMonth();
        if (this.isLoadingMonth() || !targetYearMonth) return null;

        // 保存済みの報酬月額を取得
        const saved = this.standardReward();
        // if (saved) return this.sumRewardFields(saved);

        // フォームの合計を取得（年4回以上の賞与を含む）
        const yearMonth = targetYearMonth;
        const monthlyReward = effectiveMonthlyRewardFromBase(
            this.getMonthlyReward(),
            yearMonth,
            this.confirmedEmployeeBonuses(),
        );

        // 在籍日数を取得
        const paymentBaseDays = this.paymentBaseDays();
        if (paymentBaseDays === null) return null;

        const daysInMonth = getDaysInMonth(yearMonth);
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
        const targetYearMonth = this.targetYearMonth();
        if (!employee || !targetYearMonth) return 'unknown';
        return judgeCareInsuranceStatus(
            targetYearMonth,
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

    // 随時改定の判定
    revisionPreview = computed(() => {
        const context = this.revisionProcedureContext();
        if (!context) return null;

        return {
            windowLabel: context.windowLabel,
            applyFromLabel: context.applyFromLabel,
            description: context.description,
            calculationMonths: context.calculationMonths,
            originMonth: context.originMonth,
        };
    });

    // 随時改定の判定結果
    revisionPreviewResult = computed((): string | null => {
        const preview = this.revisionPreview();
        if (!preview) return null;

        const employee = this.employee();
        if (!employee) return null;

        const qualificationDate = this.resolvedQualificationDate();
        const qualificationYearMonth = qualificationDate
            ? yearMonthFromDateString(qualificationDate)
            : null;
        if (!qualificationDate || !qualificationYearMonth) {
            return '資格取得日が未登録のため、随時改定を判定できません。';
        }

        const firstRegularYm = getFirstRegularDeterminationYearMonth(qualificationDate);
        const result = evaluateRevisionAtOrigin(
            preview.originMonth,
            qualificationYearMonth,
            firstRegularYm,
            employee,
            qualificationDate,
            confirmedRewardsByYearMonth(this.employeeRewards()),
            (monthlyReward) => this.calculator.calculate(monthlyReward),
            this.confirmedEmployeeBonuses(),
        );

        if (!result.eligible) {
            switch (result.reason) {
                case 'no_fixed_wage_change':
                    return `${formatYearMonthLabel(preview.originMonth)}に固定的賃金の変更がないため、${preview.applyFromLabel}からの随時改定は発生しません。`;
                case 'missing_months':
                    return '算定に必要な3か月分の報酬が揃っていないため、判定できません。';
                case 'no_previous_grades':
                    return '変更月の前月時点で適用されている標準報酬月額が取得できないため、判定できません。';
                case 'no_revised_grades':
                    return '改定後の等級を判定できません。';
                case 'insufficient_grade_difference':
                    return `${preview.applyFromLabel}からの随時改定は、改定後等級が適用中等級と比べて2等級以上の差がないため発生しません。`;
            }
        }

        return `${preview.applyFromLabel}から随時改定の対象になります（平均報酬月額 ${result.averageMonthlyReward.toLocaleString()} 円、${formatRevisionGradeComparison(result.previousGrades, result.revisedGrades)}）。`;
    });

    /** 対象月の支払基礎日数（資格取得日〜退職日ベース） */
    paymentBaseDays = computed((): number | null => {
        const employee = this.employee();
        const targetYearMonth = this.targetYearMonth();
        if (!employee || !targetYearMonth) return null;
        if (!isRewardTargetMonth(employee, targetYearMonth)) return null;

        const qualificationDate = this.resolvedQualificationDate();
        if (!qualificationDate) return null;

        const days = getPaymentBaseDays(
            targetYearMonth,
            qualificationDate,
            employee.retiredDate,
        );
        return days > 0 ? days : null;
    });

    // 賞与支払届
    bonusPaymentProcedure = signal<Procedure | null>(null);
    isCreatingBonusPaymentProcedure = signal(false);

    /** 年4回以上の賞与算入時は賞与支払届の対象外 */
    showBonusPaymentProcedureSection = computed(
        () => this.monthBonuses().length > 0 && !this.treatBonusAsMonthlyRemuneration(),
    );

    bonusPaymentProcedureExists = computed(() => this.bonusPaymentProcedure() !== null);

    bonusPaymentProcedureStatus = computed((): ProcedureStatus => {
        return this.bonusPaymentProcedure()?.status ?? 'notStarted';
    });

    isTargetMonth(): boolean {
        const employee = this.employee();
        const yearMonth = this.targetYearMonth();
        if (!employee || !yearMonth) return true;
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
        const yearMonth = this.targetYearMonth();
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
                return this.targetMonthReason() ?? 'この月は報酬登録の対象外です。';
            default:
                return '';
        }
    }

    effectiveCalculationMonthsLabel(): string {
        const effective = this.effectiveStandard();
        if (!effective?.calculationMonths.length) return '—';
        return this.formatYearMonthList(effective.calculationMonths);
    }

    private formatYearMonthList(months: string[]): string {
        return months.map((ym) => formatYearMonthLabel(ym)).join('・');
    }

    // 初期処理
    async ngOnInit() {
        this.isLoading.set(true);
        this.errorMessage.set('');
        this.employeeId.set(this.route.snapshot.params['employeeId'] ?? '');

        const yearMonth = this.route.snapshot.queryParams['ym'] as string | undefined;
        const initialYearMonth =
            yearMonth && /^\d{4}-\d{2}$/.test(yearMonth) ? yearMonth : this.currentYearMonth();
        this.setTargetYearMonth(initialYearMonth);
        const tab = this.route.snapshot.queryParams['tab'] as string | undefined;
        this.activeTab.set(this.resolveInitialTab(tab));
        this.resetBonusForm();

        try {
            await this.loadEmployee();
            if (this.employee()) {
                await Promise.all([this.loadEmployeeRewards(), this.loadSocialInsuranceStatus()]);
                await this.loadStandardReward();
                await this.loadMonthBonuses();
                await Promise.all([this.loadOffice(), this.loadCompany()]);
                await Promise.all([
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
        this.insurancePremiumCollectionTiming.set(company.insurancePremiumCollectionTiming);
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

    async onTargetYearMonthChange(yearMonth: string) {
        if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return;
        if (yearMonth === this.targetYearMonth()) return;

        this.setTargetYearMonth(yearMonth);
        this.standardReward.set(null);
        this.prefilledFromYearMonth.set(null);
        this.resetRewardFieldsKeepMonth();
        this.message.set('');
        this.errorMessage.set('');

        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { ym: yearMonth },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });

        this.resetBonusForm();
        this.isBonusFormVisible.set(false);
        this.bonusMessage.set('');
        this.bonusErrorMessage.set('');

        this.isLoadingMonth.set(true);
        try {
            await Promise.all([
                this.loadStandardReward(),
                this.loadMonthBonuses(),
                this.loadRegularDecisionProcedure(),
                this.loadRevisionProcedure(),
                this.loadBonusPaymentProcedure(),
            ]);
        } finally {
            this.isLoadingMonth.set(false);
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
        this.revisionProcedure.set(null);

        const employee = this.employee();
        const context = this.revisionProcedureContext();
        if (!employee || !context) return;

        try {
            const procedure = await this.procedureService.getRevisionProcedureByEmployeeIdAndTargetYearMonth(
                employee.id,
                employee.companyId,
                context.applyFromMonth,
            );
            this.revisionProcedure.set(procedure);
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

    latestRegisteredReward(): StandardMonthlyReward | null {
        const ym = this.targetYearMonth();
        if (!ym) return null;
        return findLatestRegisteredRewardBefore(ym, this.employeeRewards());
    }

    latestRegisteredYearMonthLabel(): string | null {
        const latest = this.latestRegisteredReward();
        return latest ? formatYearMonthLabel(latest.targetYearMonth) : null;
    }

    canCopyFromLatestRegistered(): boolean {
        return Boolean(this.latestRegisteredReward()) && this.isTargetMonth();
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
            `${formatYearMonthLabel(latest.targetYearMonth)}の報酬をコピーしました。変更箇所を修正して保存してください。`,
        );
    }

    prefilledFromYearMonthLabel(): string | null {
        const ym = this.prefilledFromYearMonth();
        return ym ? formatYearMonthLabel(ym) : null;
    }

    changedFixedWageFieldLabels(): string[] {
        const reward = this.standardReward();
        if (!reward?.changedFixedWageFields?.length) return [];
        return reward.changedFixedWageFields.map(
            (key) => FIXED_WAGE_FIELD_LABELS[key as FixedWageFieldKey] ?? key,
        );
    }

    previousMonthReward(): StandardMonthlyReward | null {
        const yearMonth = this.targetYearMonth();
        if (!yearMonth) return null;
        return this.employeeRewards()[addMonthsToYearMonth(yearMonth, -1)] ?? null;
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

    setActiveTab(tab: PremiumDetailTab): void {
        if (this.activeTab() === tab) return;
        this.activeTab.set(tab);
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { tab },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    private resolveInitialTab(tab: string | undefined): PremiumDetailTab {
        if (tab === 'premium') return 'premium';
        return 'input';
    }

    private setTargetYearMonth(yearMonth: string) {
        this.targetYearMonth.set(yearMonth);
        this.rewardForm.targetYearMonth = yearMonth;
    }

    async loadStandardReward() {
        const employeeId = this.employeeId();
        const targetYearMonth = this.targetYearMonth();
        if (!employeeId || !targetYearMonth) return;

        this.errorMessage.set('');
        try {
            const standardReward = await this.rewardService.getByEmployeeAndMonth(
                employeeId,
                targetYearMonth,
            );
            this.standardReward.set(standardReward);
            if (standardReward) {
                this.prefilledFromYearMonth.set(null);
                this.setFormFromStandardReward();
                this.employeeRewards.update((current) => ({
                    ...current,
                    [targetYearMonth]: standardReward,
                }));
            } else {
                const latest = findLatestRegisteredRewardBefore(
                    targetYearMonth,
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
            targetYearMonth: this.targetYearMonth(),
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
        return partTimeMonthlyRewardTotal(
            this.toNumber(form.basicSalary),
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
            targetYearMonth: this.targetYearMonth(),
            healthInsuranceGrade: 0,
            healthInsuranceStandardMonthlyAmount: 0,
            pensionInsuranceGrade: 0,
            pensionInsuranceStandardMonthlyAmount: 0,
        };

        if (this.isPartTimeEmployee()) {
            const monthlyRewardAmount = this.getPartTimeMonthlyRewardTotal();
            return {
                ...base,
                basicSalary: this.toNumber(this.rewardForm.basicSalary),
                commutingAllowance: this.toNumber(this.rewardForm.commutingAllowance),
                positionAllowance: 0,
                housingAllowance: 0,
                fixedOvertimePay: 0,
                otherFixedAllowance: this.toNumber(this.rewardForm.otherFixedAllowance),
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
            basicSalary: this.toNumber(this.rewardForm.basicSalary),
            commutingAllowance: this.toNumber(this.rewardForm.commutingAllowance),
            positionAllowance: this.toNumber(this.rewardForm.positionAllowance),
            housingAllowance: this.toNumber(this.rewardForm.housingAllowance),
            fixedOvertimePay: this.toNumber(this.rewardForm.fixedOvertimePay),
            otherFixedAllowance: this.toNumber(this.rewardForm.otherFixedAllowance),
            overtimePay: this.toNumber(this.rewardForm.overtimePay),
            holidayPay: this.toNumber(this.rewardForm.holidayPay),
            nightPay: this.toNumber(this.rewardForm.nightPay),
            commissionPay: this.toNumber(this.rewardForm.commissionPay),
            otherVariablePay: this.toNumber(this.rewardForm.otherVariablePay),
        };
    }

    private buildPreviewRewardForTargetMonth(): StandardMonthlyReward | null {
        const employee = this.employee();
        const yearMonth = this.targetYearMonth();
        const current = this.standardReward();
        if (!employee || !yearMonth || this.isLoadingMonth() || !this.isTargetMonth()) {
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
        const displayYearMonth = this.targetYearMonth();
        const allRewards = this.employeeRewards();

        const rewards = { ...confirmedRewardsByYearMonth(allRewards) };
        delete rewards[calculationYearMonth];

        if (calculationYearMonth === displayYearMonth) {
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
            if (bonusesToConfirm.length > 0) {
                this.resetBonusForm();
                this.isBonusFormVisible.set(false);
            }

            const liabilityMonths = new Set<string>();
            if (confirmReward) {
                liabilityMonths.add(this.targetYearMonth());
            }
            for (const bonus of bonusesToConfirm) {
                liabilityMonths.add(bonus.targetYearMonth);
            }
            await this.syncSavedPremiumResultsForLiabilityMonths([...liabilityMonths]);

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
            this.errorMessage.set('対象年月を選択してください');
            return;
        }
        if (!this.isTargetMonth()) {
            this.errorMessage.set(this.targetMonthReason() ?? 'この月は報酬登録の対象外です。');
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
        return this.healthInsuranceRateRow()?.employeeRate ?? null;
    });

    // 健康保険料率（会社負担）
    healthInsuranceEmployerRate = computed((): number | null => {
        return this.healthInsuranceRateRow()?.employerRate ?? null;
    });

    // 介護保険料率（本人負担）
    careInsuranceRate = computed((): number | null => {
        return this.careInsuranceRateRow()?.employeeRate ?? null;
    });

    // 介護保険料率（会社負担）
    careInsuranceEmployerRate = computed((): number | null => {
        return this.careInsuranceRateRow()?.employerRate ?? null;
    });

    /** この月に適用される健康保険の標準報酬月額（保存済み報酬のみ） */
    applicableHealthStandardAmount = computed((): number | null => {
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        this.standardReward();
        this.employeeRewards();
        if (this.isLoadingMonth() || !liabilityYearMonth) return null;
        if (!this.liabilityMonthHasConfirmedReward()) return null;

        const effective = this.effectiveStandardForPremium();
        if (effective?.isComplete && effective.calculation?.health) {
            return effective.calculation.health.standardMonthlyAmount;
        }

        return null;
    });

    hasMonthlyPremiumDisplay = computed((): boolean => {
        if (this.applicableHealthStandardAmount() === null) return false;
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

    careTargetLabel = computed(() => (this.isCarePremiumMonth() ? '対象月' : '対象外'));

    careStatusLabel = computed(() => this.displayInsuranceStatus(this.careInsuranceLiabilityJoinStatus()));

    canShowPremiumSummary = computed(() => {
        if (this.isPremiumEnrollmentUndetermined()) return false;
        if (this.hasMonthlyPremiumDisplay() || this.isMonthlyPremiumNotSubject()) {
            return true;
        }
        const bonusPremium = this.bonusSocialInsuranceEmployeePremium();
        return bonusPremium !== null && bonusPremium > 0;
    });

    healthPremiumAmountDisplay = computed((): InsurancePremiumAmountDisplay => {
        return this.resolvePremiumAmountDisplay(
            this.healthInsuranceJoinStatus(),
            this.isHealthPremiumMonth(),
            this.healthInsurancePremium(),
        );
    });

    pensionPremiumAmountDisplay = computed((): InsurancePremiumAmountDisplay => {
        return this.resolvePremiumAmountDisplay(
            this.pensionInsuranceJoinStatus(),
            this.isPensionPremiumMonth(),
            this.pensionInsurancePremium(),
        );
    });

    carePremiumAmountDisplay = computed((): InsurancePremiumAmountDisplay => {
        return this.resolvePremiumAmountDisplay(
            this.careInsuranceLiabilityJoinStatus(),
            this.isCarePremiumMonth(),
            this.careInsurancePremium(),
        );
    });

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

    // 健康保険料（本人負担）
    healthInsurancePremium = computed((): number | null => {
        if (!this.isHealthPremiumMonth()) return null;
        return this.calculatePremium(this.applicableHealthStandardAmount(), this.healthInsuranceRate());
    });

    // 健康保険料（会社負担）
    healthInsuranceEmployerPremium = computed((): number | null => {
        if (!this.isHealthPremiumMonth()) return null;
        return this.calculatePremium(
            this.applicableHealthStandardAmount(),
            this.healthInsuranceEmployerRate(),
        );
    });

    // 厚生年金料率
    pensionInsuranceRate = 0.0915;

    // 厚生年金料（本人負担）
    pensionInsurancePremium = computed((): number | null => {
        if (!this.isPensionPremiumMonth()) return null;
        return this.calculatePremium(this.applicableHealthStandardAmount(), this.pensionInsuranceRate);
    });

    // 厚生年金料（会社負担）
    pensionInsuranceEmployerPremium = computed((): number | null => {
        if (!this.isPensionPremiumMonth()) return null;
        return this.calculatePremium(this.applicableHealthStandardAmount(), this.pensionInsuranceRate);
    });

    // 介護保険料（本人負担）
    careInsurancePremium = computed((): number | null => {
        if (!this.isCarePremiumMonth()) return null;
        return this.calculatePremium(this.applicableHealthStandardAmount(), this.careInsuranceRate());
    });

    // 介護保険料（会社負担）
    careInsuranceEmployerPremium = computed((): number | null => {
        if (!this.isCarePremiumMonth()) return null;
        return this.calculatePremium(
            this.applicableHealthStandardAmount(),
            this.careInsuranceEmployerRate(),
        );
    });

    // 社会保険料の合計（本人負担）
    socialInsurancePremium = computed((): number | null => {
        const healthPremium = this.healthInsurancePremium() ?? 0;
        const pensionPremium = this.pensionInsurancePremium() ?? 0;
        const carePremium = this.careInsurancePremium() ?? 0;
        return healthPremium + pensionPremium + carePremium;
    });

    // 社会保険料の合計（会社負担）
    socialInsuranceEmployerPremium = computed((): number | null => {
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
            this.isBonusFormVisible.set(filtered.length === 0);
        } catch (error) {
            console.error('賞与の取得に失敗しました', error);
            this.bonusErrorMessage.set('賞与の取得に失敗しました');
        } finally {
            this.isLoadingBonus.set(false);
        }
    }

    isBonusEditable = computed(() => !this.isLoadingMonth() && !this.isLoadingBonus());

    editingBonus = computed((): BonusReward | null => {
        const paymentDate = this.bonusForm.paymentDate.trim();
        if (!paymentDate) return null;
        return this.monthBonuses().find((bonus) => bonus.paymentDate === paymentDate) ?? null;
    });

    isBonusFormEditable = computed(() => {
        if (!this.isBonusFormVisible() || !this.isBonusEditable()) return false;
        const editing = this.editingBonus();
        return !editing || isBonusDraft(editing);
    });

    bonusStatusLabel(bonus: BonusReward): string {
        return normalizeBonusStatus(bonus) === 'draft' ? '下書き' : '確定';
    }

    canSelectBonusForEdit(bonus: BonusReward): boolean {
        return isBonusDraft(bonus);
    }

    selectBonusForEdit(bonus: BonusReward) {
        if (!this.canSelectBonusForEdit(bonus)) return;
        this.bonusForm = {
            paymentDate: bonus.paymentDate,
            bonusAmount: bonus.bonusAmount,
        };
        this.bonusErrorMessage.set('');
        this.bonusMessage.set('');
        this.isBonusFormVisible.set(true);
    }

    openNewBonusForm() {
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
    private defaultBonusPaymentDate(): string {
        const targetYearMonth = this.targetYearMonth();
        return targetYearMonth ? `${targetYearMonth}-01` : '';
    }

    // 賞与を保存（下書き）
    async saveBonusReward() {
        await this.persistBonusReward('draft');
    }

    async deleteDraftBonus(bonus: BonusReward, event?: Event) {
        event?.preventDefault();
        event?.stopPropagation();
        if (!isBonusDraft(bonus)) return;

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
        if (bonusAmount <= 0) {
            this.bonusErrorMessage.set('賞与額を入力してください');
            return;
        }

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
            if (mode === 'confirmed') {
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
        const monthly = this.socialInsurancePremium() ?? 0;
        const bonus = this.bonusSocialInsuranceEmployeePremium() ?? 0;
        return monthly + bonus;
    });

    insuranceRatePercentLabel(rate: number | null): string | null {
        if (rate === null) return null;
        return Number((rate * 100).toFixed(3)).toString();
    }

    private healthInsuranceFiscalYear(targetYearMonth: string): string {
        const [y, m] = targetYearMonth.split('-').map(Number);
        return m < 3 ? String(y - 1) : String(y);
    }

    private healthInsuranceRateRow() {
        const targetYearMonth = this.premiumLiabilityYearMonth();
        if (!targetYearMonth) return null;

        const fiscalYear = this.healthInsuranceFiscalYear(targetYearMonth);
        const fileName = `kyokai-health-insurance-rates-${fiscalYear}-03.ts`;
        const rates =
            KYOKAI_HEALTH_INSURANCE_RATE_FILES.find((file) => file.fileName === fileName)?.rates ?? [];

        return findHealthInsuranceRate({
            rates,
            targetYearMonth,
            providerType: this.office()?.healthInsuranceType ?? 'kyokai',
            prefecture: resolveOfficePrefecture(this.office(), this.employee()?.prefecture),
        });
    }

    private careInsuranceRateRow() {
        const targetYearMonth = this.premiumLiabilityYearMonth();
        if (!targetYearMonth) return null;

        return findCareInsuranceRate(targetYearMonth);
    }

    // 保険料を計算
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

        return {
            health: this.isHealthPremiumMonth()
                ? this.calculatePremium(
                      amounts.healthAndCare,
                      employer ? this.healthInsuranceEmployerRate() : this.healthInsuranceRate(),
                  )
                : null,
            pension: this.isPensionPremiumMonth()
                ? this.calculatePremium(amounts.pension, this.pensionInsuranceRate)
                : null,
            care: this.isCarePremiumMonth()
                ? this.calculatePremium(
                      amounts.healthAndCare,
                      employer ? this.careInsuranceEmployerRate() : this.careInsuranceRate(),
                  )
                : null,
        };
    }

    private calculatePremium(amount: number | null, rate: number | null): number | null {
        const targetYearMonth = this.targetYearMonth();
        this.formRewardRevision();
        this.standardReward();
        this.employeeRewards();
        if (this.isLoadingMonth() || !targetYearMonth) return null;
        if (amount === null || rate === null) return null;

        return roundInsurancePremium(amount * rate);
    }

    private bumpFormRewardRevision(): void {
        this.formRewardRevision.update((v) => v + 1);
    }

    readonly regularDecisionProcedureStatusLabel = procedureStatusLabel;
    readonly revisionProcedureStatusLabel = procedureStatusLabel;
    readonly bonusPaymentProcedureStatusLabel = procedureStatusLabel;

    async openBonusPaymentProcedure(): Promise<void> {
        const employee = this.employee();
        const targetYearMonth = this.targetYearMonth();
        const bonus = this.monthBonuses()[0];
        if (!employee || !targetYearMonth || !bonus || this.isCreatingBonusPaymentProcedure()) return;
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
                occurredDate: bonus.paymentDate,
                dueDate: '',
                completedDate: null,
                submittedDate: null,
                targetYearMonth,
                memo: '',
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

    async openRevisionProcedure(): Promise<void> {
        const employee = this.employee();
        const context = this.revisionProcedureContext();
        if (!employee || !context || this.isCreatingRevisionProcedure()) return;

        const existing = this.revisionProcedure();
        if (existing) {
            this.router.navigate(['/procedures', existing.id]);
            return;
        }

        this.isCreatingRevisionProcedure.set(true);
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
            this.revisionProcedure.set(procedure);
            this.router.navigate(['/procedures', procedure.id]);
        } catch (error) {
            console.error('月額変更届の作成に失敗しました', error);
            this.errorMessage.set('月額変更届の作成に失敗しました');
        } finally {
            this.isCreatingRevisionProcedure.set(false);
        }
    }

    async openRegularDecisionProcedure(): Promise<void> {
        const employee = this.employee();
        const targetYearMonth = this.regularDecisionTargetYearMonth();
        if (!employee || !targetYearMonth || this.isCreatingRegularDecisionProcedure()) return;

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
                dueDate: '',
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
