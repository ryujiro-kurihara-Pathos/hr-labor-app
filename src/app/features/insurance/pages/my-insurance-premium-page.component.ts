import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';
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
    resolvePremiumStandardDeterminationYearMonth,
} from '../../company/utils/company-payroll-settings.util';
import { OfficeService } from '../../company/services/office.service';
import { resolveOfficePrefecture } from '../../company/utils/office-prefecture.util';
import { SocialInsuranceStatus } from '../../social-insurance/models/social-insurance-status.model';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import {
    findLatestConfirmedPayYearMonth,
    isJoinMonthZeroPremiumDeductionView,
    isPremiumBasisRewardConfirmed,
} from '../utils/reward-pay-month.util';
import { StandardMonthlyRewardService } from '../services/standard-monthly-reward.service';
import { StandardRemunerationDeterminationService } from '../services/standard-remuneration-determination.service';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { isBonusConfirmed } from '../../bonus/utils/bonus-status.util';
import {
    addMonthsToYearMonth,
    clampPremiumViewableYearMonth,
    isPremiumViewableYearMonth,
    isRewardTargetMonth,
    listPremiumViewableYearMonths,
    premiumViewableYearMonthMax,
    premiumViewableYearMonthReason,
    viewableYearMonthMin,
    yearMonthFromDateString,
} from '../utils/reward-target-month.util';
import {
    confirmedRewardsByYearMonth,
    isRewardConfirmed,
} from '../utils/reward-status.util';
import {
    bonusesForStandardBonusPremium,
    shouldTreatBonusAsMonthlyRemuneration,
} from '../utils/effective-monthly-reward.util';
import { resolveBonusPremiumableStandardAmounts } from '../utils/bonus-standard-amount-cap.util';
import {
    formatYearMonthLabel,
    formatYearMonthList,
    getQualificationDate,
} from '../utils/standard-remuneration-determination.util';
import { findCareInsuranceRate, findHealthInsuranceRate } from '../../insurance-rate/utils/insurance-rate-lookup.util';
import { KYOKAI_HEALTH_INSURANCE_RATE_FILES } from '../../insurance-rate/data/insurance-rates';
import { InsuranceRateRow } from '../../insurance-rate/models/insurance-rate.model';
import { calculateInsurancePremiumShares } from '../utils/insurance-premium-rounding.util';
import { resolveMonthlyPremiumStandardAmounts } from '../utils/insurance-premium-standard-amount.util';
import { DEFAULT_PENSION_INSURANCE_TOTAL_RATE } from '../utils/insurance-premium-rate-resolution.util';
import { insuranceJoinStatusLabel } from '../../social-insurance/utils/social-insurance-status-display.util';
import { insuranceJoinStatus } from '../../social-insurance/models/social-insurance-status.model';
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
import {
    computeCareInsurancePeriod,
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

const PENSION_EMPLOYEE_RATE = 0.0915;
const PENSION_TOTAL_RATE = DEFAULT_PENSION_INSURANCE_TOTAL_RATE;

type RewardField = {
    label: string;
    value: number;
};

@Component({
    selector: 'app-my-insurance-premium',
    standalone: true,
    imports: [FormsModule, DecimalPipe],
    templateUrl: './my-insurance-premium-page.component.html',
})
export class MyInsurancePremiumPageComponent implements OnInit {
    readonly pensionRate = PENSION_EMPLOYEE_RATE;

    readonly premiumDisplayAmountValue = premiumDisplayAmountValue;
    readonly premiumDisplayShowsZero = premiumDisplayShowsZero;
    readonly premiumDisplayNote = premiumDisplayNote;
    readonly premiumDisplayIsAmount = premiumDisplayIsAmount;

    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly companyService = inject(CompanyService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly bonusRewardService = inject(BonusRewardService);
    private readonly router = inject(Router);

    employee = signal<Employee | null>(null);
    office = signal<Office | null>(null);
    company = signal<Company | null>(null);
    insurancePremiumCollectionTiming = signal<InsurancePremiumCollectionTiming>(
        APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
    );

    readonly insurancePremiumCollectionTimingAppNote = INSURANCE_PREMIUM_COLLECTION_TIMING_APP_NOTE;
    insuranceStatus = signal<SocialInsuranceStatus | null>(null);
    standardReward = signal<StandardMonthlyReward | null>(null);
    allRewards = signal<StandardMonthlyReward[]>([]);
    effectiveStandard = signal<EffectiveStandardRemuneration | null>(null);
    monthBonuses = signal<BonusReward[]>([]);
    allBonuses = signal<BonusReward[]>([]);
    healthRateRow = signal<InsuranceRateRow | null>(null);
    careRateRow = signal<InsuranceRateRow | null>(null);

    targetYearMonth = signal(this.currentYearMonth());
    isLoading = signal(true);
    isLoadingMonth = signal(false);
    errorMessage = signal('');

    targetYearMonthLabel = computed(() => formatYearMonthLabel(this.targetYearMonth()));

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
        const rewardsByYearMonth = Object.fromEntries(
            this.allRewards().map((item) => [item.targetYearMonth, item]),
        );
        return findLatestConfirmedPayYearMonth(
            rewardsByYearMonth,
            this.company()?.payrollPaymentMonthOffset ?? 1,
        );
    });

    resolvedQualificationDate = computed((): string | null => {
        const employee = this.employee();
        const status = this.insuranceStatus();
        if (!employee) return null;
        return getQualificationDate(employee, status?.healthInsuranceStartDate ?? null);
    });

    isNextMonthCollection = computed(
        () => this.insurancePremiumCollectionTiming() === 'next_month',
    );

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

    viewableMinYearMonth = computed(() => {
        const employee = this.employee();
        return employee ? viewableYearMonthMin(employee) : null;
    });

    viewableMaxYearMonth = computed(() => {
        const employee = this.employee();
        return employee
            ? premiumViewableYearMonthMax(
                employee,
                this.currentYearMonth(),
                this.insurancePremiumCollectionTiming(),
                this.latestConfirmedWorkYearMonth(),
            )
            : null;
    });

    viewablePeriodLabel = computed(() => {
        const minYm = this.viewableMinYearMonth();
        const maxYm = this.viewableMaxYearMonth();
        if (!minYm || !maxYm) return null;
        return `${formatYearMonthLabel(minYm)}〜${formatYearMonthLabel(maxYm)}`;
    });

    isViewableMonth = computed(() => {
        const employee = this.employee();
        const ym = this.targetYearMonth();
        return Boolean(
            employee
            && ym
            && isPremiumViewableYearMonth(
                employee,
                ym,
                this.currentYearMonth(),
                this.insurancePremiumCollectionTiming(),
                this.latestConfirmedWorkYearMonth(),
            ),
        );
    });

    canGoPrevMonth = computed(() => {
        const minYm = this.viewableMinYearMonth();
        const ym = this.targetYearMonth();
        return Boolean(minYm && ym && ym > minYm);
    });

    canGoNextMonth = computed(() => {
        const maxYm = this.viewableMaxYearMonth();
        const ym = this.targetYearMonth();
        return Boolean(maxYm && ym && ym < maxYm);
    });

    viewableMonthReason = computed(() => {
        const employee = this.employee();
        const ym = this.targetYearMonth();
        if (!employee || !ym) return null;
        return premiumViewableYearMonthReason(
            employee,
            ym,
            this.currentYearMonth(),
            this.insurancePremiumCollectionTiming(),
            this.latestConfirmedWorkYearMonth(),
        );
    });

    unconfirmedMonthsInRange = computed(() => {
        const employee = this.employee();
        if (!employee) return [];

        const rewardsByYearMonth = Object.fromEntries(
            this.allRewards().map((reward) => [reward.targetYearMonth, reward]),
        );
        const timing = this.insurancePremiumCollectionTiming();

        return listPremiumViewableYearMonths(
            employee,
            this.currentYearMonth(),
            timing,
            this.latestConfirmedWorkYearMonth(),
        ).filter(
            (payYearMonth) => {
                return !isPremiumBasisRewardConfirmed(
                    rewardsByYearMonth,
                    payYearMonth,
                    timing,
                    this.company()?.payrollPaymentMonthOffset ?? 1,
                    yearMonthFromDateString(employee.joinedDate),
                );
            },
        );
    });

    unconfirmedMonthsLabel = computed(() => {
        const months = this.unconfirmedMonthsInRange();
        if (months.length === 0) return null;
        return formatYearMonthList(months);
    });

    treatBonusAsMonthlyRemuneration = computed(() => {
        const ym = this.targetYearMonth();
        if (!ym) return false;
        return shouldTreatBonusAsMonthlyRemuneration(this.allBonuses(), ym);
    });

    bonusesForPremium = computed(() => {
        const payYearMonth = this.targetYearMonth();
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!payYearMonth || !liabilityYearMonth) return [];
        const bonusesInPayMonth = this.allBonuses().filter(
            (bonus) => bonus.targetYearMonth === payYearMonth,
        );
        return bonusesForStandardBonusPremium(
            bonusesInPayMonth,
            liabilityYearMonth,
            this.allBonuses(),
        );
    });

    standardAmount = computed((): number | null => {
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!liabilityYearMonth || !this.liabilityMonthHasConfirmedReward()) return null;

        const effective = this.effectiveStandardForPremium();
        if (!effective?.isComplete || !effective.calculation?.health) return null;
        return resolveMonthlyPremiumStandardAmounts(effective.calculation).health;
    });

    pensionStandardAmount = computed((): number | null => {
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        if (!liabilityYearMonth || !this.liabilityMonthHasConfirmedReward()) return null;

        const effective = this.effectiveStandardForPremium();
        if (!effective?.isComplete || !effective.calculation?.health) return null;
        return resolveMonthlyPremiumStandardAmounts(effective.calculation).pension;
    });

    liabilityMonthHasConfirmedReward = computed((): boolean => {
        const payYearMonth = this.targetYearMonth();
        if (!payYearMonth) return false;
        const rewardsByYearMonth = Object.fromEntries(
            this.allRewards().map((item) => [item.targetYearMonth, item]),
        );
        return isPremiumBasisRewardConfirmed(
            rewardsByYearMonth,
            payYearMonth,
            this.insurancePremiumCollectionTiming(),
            this.company()?.payrollPaymentMonthOffset ?? 1,
            yearMonthFromDateString(this.employee()?.joinedDate ?? ''),
        );
    });

    healthInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return resolveHealthInsuranceJoinStatus(
            this.insuranceStatus()?.healthInsuranceStatus,
            this.socialInsuranceJoinJudgmentContext(),
        );
    });

    pensionInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return resolvePensionInsuranceJoinStatus(
            this.insuranceStatus()?.pensionInsuranceStatus,
            this.socialInsuranceJoinJudgmentContext(),
        );
    });

    socialInsuranceJoinJudgmentContext = computed(() =>
        buildSocialInsuranceJoinJudgmentContext(
            this.employee(),
            this.insuranceStatus(),
            this.office(),
        ),
    );

    careInsuranceLiabilityJoinStatus = computed((): insuranceJoinStatus => {
        const employee = this.employee();
        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const status = this.insuranceStatus();
        if (!employee || !liabilityYearMonth || !status) return 'unknown';
        return judgeCareInsuranceStatus(
            liabilityYearMonth,
            status.healthInsuranceStartDate,
            status.healthInsuranceEndDate,
            employee.birthDate,
        );
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

        if (!this.isNextMonthCollection()) return false;

        if (!isRewardTargetMonth(employee, liabilityYearMonth)) return true;

        const joinYearMonth = yearMonthFromDateString(employee.joinedDate);
        if (joinYearMonth && liabilityYearMonth < joinYearMonth) return true;

        const qualificationYearMonth = yearMonthFromDateString(this.resolvedQualificationDate());
        if (qualificationYearMonth && liabilityYearMonth < qualificationYearMonth) {
            return true;
        }

        return false;
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

        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const employee = this.employee();
        const joinYearMonth = employee ? yearMonthFromDateString(employee.joinedDate) : null;
        const beforeEmploymentReason = formatZeroPremiumBeforeEmploymentReason({
            payYearMonth: this.targetYearMonth(),
            joinYearMonth,
            liabilityYearMonth,
        });
        if (beforeEmploymentReason) return beforeEmploymentReason;

        const qualificationYearMonth = yearMonthFromDateString(this.resolvedQualificationDate());
        if (
            qualificationYearMonth
            && liabilityYearMonth
            && liabilityYearMonth < qualificationYearMonth
        ) {
            const qualificationLabel = formatYearMonthLabel(qualificationYearMonth);
            return `${NOT_SUBJECT_LABEL}（資格取得前。${qualificationLabel}以降の報酬に基づく保険料は、翌月以降の控除月で表示されます）`;
        }

        return NOT_SUBJECT_LABEL;
    });

    premiumSummaryUndeterminedReason = computed((): string | null => {
        const enrollment = this.premiumEnrollmentUndeterminedReason();
        if (enrollment) return enrollment;

        if (this.isJoinMonthZeroPremiumDeductionView()) return null;

        if (!this.liabilityMonthHasConfirmedReward()) {
            if (this.showZeroMonthlyPremiumDueToCollectionTiming()) return null;

            const payLabel = this.targetYearMonthLabel();
            const basisLabel = this.premiumLiabilityYearMonthLabel();
            if (this.isNextMonthCollection() && basisLabel && basisLabel !== payLabel) {
                return `${payLabel}に払う保険料を表示するには、${payLabel}の報酬を確定してください。`;
            }
            return `${basisLabel || payLabel}の報酬が未確定のため、保険料を判定できません。`;
        }

        return null;
    });

    canShowPremiumSummary = computed((): boolean => {
        if (this.isPremiumEnrollmentUndetermined()) return false;
        if (this.isJoinMonthZeroPremiumDeductionView()) return true;
        if (this.premiumSummaryUndeterminedReason()) return false;
        return this.hasMonthlyPremiumDisplay()
            || this.isMonthlyPremiumNotSubject()
            || (this.bonusSocialInsurancePremium() ?? 0) > 0;
    });

    effectiveStandardForPremium = computed(() => {
        const employee = this.employee();
        const payYearMonth = this.targetYearMonth();
        if (!employee || !payYearMonth) return null;

        const rewardsByYearMonth = confirmedRewardsByYearMonth(
            Object.fromEntries(this.allRewards().map((item) => [item.targetYearMonth, item])),
        );
        const standardDeterminationYearMonth = resolvePremiumStandardDeterminationYearMonth(
            payYearMonth,
            this.insurancePremiumCollectionTiming(),
        );

        return this.determinationService.resolve(
            employee,
            rewardsByYearMonth,
            standardDeterminationYearMonth,
            this.insuranceStatus()?.healthInsuranceStartDate ?? null,
            this.allBonuses(),
            this.company()?.payrollPaymentMonthOffset ?? 1,
            [],
            this.socialInsuranceJoinJudgmentContext(),
        );
    });

    hasMonthlyPremiumDisplay = computed((): boolean => {
        if (this.standardAmount() === null) return false;
        return this.isHealthPremiumMonth() || this.isPensionPremiumMonth() || this.isCarePremiumMonth();
    });

    healthGrade = computed((): number | null => {
        return this.effectiveStandard()?.calculation?.health?.grade ?? null;
    });

    pensionGrade = computed((): number | null => {
        return this.effectiveStandard()?.calculation?.pension?.grade ?? null;
    });

    isHealthPremiumMonth = computed(() => {
        const employee = this.employee();
        const ym = this.premiumLiabilityYearMonth();
        const status = this.insuranceStatus();
        if (!status || !ym) return false;
        return isHealthInsurancePremiumTargetMonth(
            ym,
            this.resolvedQualificationDate(),
            status.healthInsuranceEndDate,
            employee?.birthDate ?? null,
        );
    });

    isPensionPremiumMonth = computed(() => {
        const employee = this.employee();
        const ym = this.premiumLiabilityYearMonth();
        const status = this.insuranceStatus();
        if (!status || !ym) return false;
        return isPensionInsurancePremiumTargetMonth(
            ym,
            this.resolvedQualificationDate(),
            status.healthInsuranceEndDate,
            status.pensionInsuranceStartDate,
            status.pensionInsuranceEndDate,
            employee?.birthDate ?? null,
        );
    });

    healthPremium = computed(() => {
        if (!this.isHealthPremiumMonth()) return null;
        return this.calculateEmployeePremium(
            this.standardAmount(),
            this.healthRateRow()?.totalRate ?? null,
        );
    });

    pensionPremium = computed(() => {
        if (!this.isPensionPremiumMonth()) return null;
        return this.calculateEmployeePremium(this.pensionStandardAmount(), PENSION_TOTAL_RATE);
    });

    isCarePremiumMonth = computed(() => {
        const status = this.insuranceStatus();
        const employee = this.employee();
        const ym = this.premiumLiabilityYearMonth();
        if (!status || !employee || !ym) return false;
        return isCareInsurancePremiumTargetMonth(
            ym,
            this.resolvedQualificationDate(),
            status.healthInsuranceEndDate,
            employee.birthDate,
        );
    });

    careInsurancePeriod = computed(() => {
        const status = this.insuranceStatus();
        const employee = this.employee();
        return computeCareInsurancePeriod(
            status?.healthInsuranceStartDate,
            status?.healthInsuranceEndDate,
            employee?.birthDate ?? null,
        );
    });

    carePremium = computed(() => {
        if (!this.isCarePremiumMonth()) return null;
        return this.calculateEmployeePremium(
            this.standardAmount(),
            this.careRateRow()?.totalRate ?? null,
        );
    });

    monthlySocialInsurancePremium = computed((): number | null => {
        const parts = [this.healthPremium(), this.pensionPremium(), this.carePremium()];
        if (parts.every((value) => value === null)) return null;
        return (this.healthPremium() ?? 0) + (this.pensionPremium() ?? 0) + (this.carePremium() ?? 0);
    });

    bonusSocialInsurancePremium = computed((): number | null => {
        if (!this.liabilityMonthHasConfirmedReward()) return null;

        const liabilityYearMonth = this.premiumLiabilityYearMonth();
        const bonuses = this.bonusesForPremium();
        if (!liabilityYearMonth || bonuses.length === 0) return null;
        if (!bonuses.some((bonus) => bonus.standardBonusAmount > 0)) return null;

        const amounts = resolveBonusPremiumableStandardAmounts({
            liabilityYearMonth,
            monthBonuses: bonuses,
            allBonuses: this.allBonuses().filter((bonus) => isBonusConfirmed(bonus)),
        });

        const health = this.isHealthPremiumMonth()
            ? this.calculateEmployeePremium(
                amounts.healthAndCare,
                this.healthRateRow()?.totalRate ?? null,
            ) ?? 0
            : 0;
        const pension = this.isPensionPremiumMonth()
            ? this.calculateEmployeePremium(amounts.pension, PENSION_TOTAL_RATE) ?? 0
            : 0;
        const care = this.isCarePremiumMonth()
            ? this.calculateEmployeePremium(
                amounts.healthAndCare,
                this.careRateRow()?.totalRate ?? null,
            ) ?? 0
            : 0;

        return health + pension + care;
    });

    totalSocialInsurancePremium = computed((): number | null => {
        const monthly = this.monthlySocialInsurancePremium();
        const bonus = this.bonusSocialInsurancePremium();
        if (monthly === null && bonus === null) return null;
        return (monthly ?? 0) + (bonus ?? 0);
    });

    isMonthRewardConfirmed = computed(() => isRewardConfirmed(this.standardReward()));

    monthRewardStatusLabel = computed(() =>
        this.isMonthRewardConfirmed() ? '確定' : '登録されていない',
    );

    monthRewardStatusClass = computed(() =>
        this.isMonthRewardConfirmed() ? 'confirmed' : 'unregistered',
    );

    monthRewardTotal = computed((): number | null => {
        const reward = this.standardReward();
        if (!reward) return null;
        return this.sumRewardFields(reward);
    });

    rewardFields = computed((): RewardField[] => {
        const reward = this.standardReward();
        if (!reward) return [];

        const fields: RewardField[] = [
            { label: '基本給', value: reward.basicSalary },
            { label: '通勤手当', value: reward.commutingAllowance },
            { label: '役職手当', value: reward.positionAllowance },
            { label: '住宅手当', value: reward.housingAllowance },
            { label: '見込み残業代', value: reward.fixedOvertimePay },
            { label: 'その他固定手当', value: reward.otherFixedAllowance },
            { label: '残業代', value: reward.overtimePay },
            { label: '休日手当', value: reward.holidayPay },
            { label: '深夜手当', value: reward.nightPay },
            { label: 'インセンティブ', value: reward.commissionPay },
            { label: 'その他変動手当', value: reward.otherVariablePay },
        ];
        return fields.filter((field) => field.value > 0);
    });

    determinationBadgeClass = computed(() => {
        const type = this.effectiveStandard()?.determinationType;
        if (type === 'initial') return 'initial';
        if (type === 'revision') return 'revision';
        return 'regular';
    });

    effectiveCalculationMonthsLabel = computed(() => {
        const months = this.effectiveStandard()?.calculationMonths ?? [];
        if (months.length === 0) return '—';
        return formatYearMonthList(months);
    });

    careTargetLabel = computed(() => {
        if (!this.isCarePremiumMonth()) return '対象外';
        return '開始対象月〜終了月の範囲内';
    });

    careStatusForMonth = computed(() => this.careInsuranceLiabilityJoinStatus());

    healthPremiumAmountDisplay = computed((): InsurancePremiumAmountDisplay => {
        return this.resolvePremiumAmountDisplay(
            this.healthInsuranceJoinStatus(),
            this.isHealthPremiumMonth(),
            this.healthPremium(),
        );
    });

    pensionPremiumAmountDisplay = computed((): InsurancePremiumAmountDisplay => {
        return this.resolvePremiumAmountDisplay(
            this.pensionInsuranceJoinStatus(),
            this.isPensionPremiumMonth(),
            this.pensionPremium(),
        );
    });

    carePremiumAmountDisplay = computed((): InsurancePremiumAmountDisplay => {
        return this.resolvePremiumAmountDisplay(
            this.careInsuranceLiabilityJoinStatus(),
            this.isCarePremiumMonth(),
            this.carePremium(),
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

    async ngOnInit(): Promise<void> {
        await this.loadPage();
    }

    async onTargetYearMonthChange(yearMonth: string): Promise<void> {
        const employee = this.employee();
        if (!employee || !yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return;

        const clamped = clampPremiumViewableYearMonth(
            employee,
            yearMonth,
            this.currentYearMonth(),
            this.insurancePremiumCollectionTiming(),
            this.latestConfirmedWorkYearMonth(),
        );
        if (clamped === this.targetYearMonth()) return;

        this.targetYearMonth.set(clamped);
        await this.loadMonthData();
    }

    async shiftMonth(delta: number): Promise<void> {
        if ((delta < 0 && !this.canGoPrevMonth()) || (delta > 0 && !this.canGoNextMonth())) {
            return;
        }

        const next = addMonthsToYearMonth(this.targetYearMonth(), delta);
        const employee = this.employee();
        if (!employee) return;

        this.targetYearMonth.set(clampPremiumViewableYearMonth(
            employee,
            next,
            this.currentYearMonth(),
            this.insurancePremiumCollectionTiming(),
            this.latestConfirmedWorkYearMonth(),
        ));
        await this.loadMonthData();
    }

    insuranceRatePercentLabel(rate: number | null | undefined): string {
        if (rate == null) return '—';
        return `${Number((rate * 100).toFixed(3))}%`;
    }

    careStatusLabel(): string {
        return insuranceJoinStatusLabel(this.careStatusForMonth());
    }

    formatPaymentDate(value: string): string {
        if (!value) return '—';
        const [y, m, d] = value.split('-');
        if (!y || !m || !d) return value;
        return `${y}/${m}/${d}`;
    }

    private async loadPage(): Promise<void> {
        this.isLoading.set(true);
        this.errorMessage.set('');

        try {
            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) {
                await this.router.navigate(['/login']);
                return;
            }

            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (!appUser) {
                this.errorMessage.set('ユーザー情報が見つかりませんでした');
                return;
            }

            if (appUser.status === 'inactive') {
                await this.authService.logout();
                await this.router.navigate(['/login']);
                return;
            }

            if (!appUser.employeeId) {
                this.errorMessage.set('従業員情報が紐づいていません。管理者にお問い合わせください。');
                return;
            }

            const employee = await this.employeeService.getEmployeeById(appUser.employeeId);
            if (!employee) {
                this.errorMessage.set('従業員情報が見つかりませんでした');
                return;
            }

            this.employee.set(employee);

            const [status, office, allBonuses, company] = await Promise.all([
                this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employee.id),
                this.officeService.getOfficeById(employee.officeId),
                this.bonusRewardService.getBonusRewardsByEmployee(employee.companyId, employee.id),
                this.companyService.getCompanyById(employee.companyId),
            ]);

            this.insuranceStatus.set(status);
            this.office.set(office);
            this.allBonuses.set(allBonuses);
            this.company.set(company);
            if (company) {
                this.insurancePremiumCollectionTiming.set(APP_INSURANCE_PREMIUM_COLLECTION_TIMING);
            }

            const allRewards = await this.rewardService.listByEmployee(employee.id);
            this.allRewards.set(allRewards);

            this.targetYearMonth.set(
                clampPremiumViewableYearMonth(
                    employee,
                    this.targetYearMonth(),
                    this.currentYearMonth(),
                    this.insurancePremiumCollectionTiming(),
                    this.latestConfirmedWorkYearMonth(),
                ),
            );

            await this.loadMonthData();
        } catch (error) {
            console.error('保険料ページの取得に失敗しました', error);
            this.errorMessage.set('保険料情報の取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    private async loadMonthData(): Promise<void> {
        const employee = this.employee();
        const targetYearMonth = this.targetYearMonth();
        if (!employee || !targetYearMonth) return;

        this.isLoadingMonth.set(true);

        try {
            const liabilityYearMonth = resolvePremiumLiabilityYearMonth(
                targetYearMonth,
                this.insurancePremiumCollectionTiming(),
            );

            const reward = await this.rewardService.getByEmployeeAndMonth(employee.id, targetYearMonth);

            const allRewards = await this.rewardService.listByEmployee(employee.id);

            this.standardReward.set(reward);
            this.allRewards.set(allRewards);

            const monthBonuses = this.allBonuses()
                .filter((bonus) => bonus.targetYearMonth === targetYearMonth)
                .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
            this.monthBonuses.set(monthBonuses);

            const rewardsByYearMonth = confirmedRewardsByYearMonth(
                Object.fromEntries(allRewards.map((item) => [item.targetYearMonth, item])),
            );

            const effective = liabilityYearMonth
                ? this.determinationService.resolve(
                    employee,
                    rewardsByYearMonth,
                    resolvePremiumStandardDeterminationYearMonth(
                        targetYearMonth,
                        this.insurancePremiumCollectionTiming(),
                    ),
                    this.insuranceStatus()?.healthInsuranceStartDate ?? null,
                    this.allBonuses(),
                    this.company()?.payrollPaymentMonthOffset ?? 1,
                    [],
                    this.socialInsuranceJoinJudgmentContext(),
                )
                : null;
            this.effectiveStandard.set(effective);

            const office = this.office();
            if (office) {
                const fiscalYear = this.healthInsuranceFiscalYear(liabilityYearMonth);
                const fileName = `kyokai-health-insurance-rates-${fiscalYear}-03.ts`;
                const rates =
                    KYOKAI_HEALTH_INSURANCE_RATE_FILES.find((file) => file.fileName === fileName)?.rates ?? [];

                this.healthRateRow.set(
                    findHealthInsuranceRate({
                        rates,
                        targetYearMonth: liabilityYearMonth,
                        providerType: office.healthInsuranceType ?? 'kyokai',
                        prefecture: resolveOfficePrefecture(office, this.employee()?.prefecture),
                    }),
                );
                this.careRateRow.set(findCareInsuranceRate(liabilityYearMonth));
            } else {
                this.healthRateRow.set(null);
                this.careRateRow.set(null);
            }
        } catch (error) {
            console.error('月次データの取得に失敗しました', error);
            this.errorMessage.set('月次データの取得に失敗しました');
        } finally {
            this.isLoadingMonth.set(false);
        }
    }

    private calculateEmployeePremium(amount: number | null, totalRate: number | null): number | null {
        if (amount === null || totalRate === null) return null;
        return calculateInsurancePremiumShares(amount, totalRate).employeePremium;
    }

    private sumRewardFields(reward: StandardMonthlyReward): number {
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

    private currentYearMonth(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    private healthInsuranceFiscalYear(targetYearMonth: string): string {
        const [y, m] = targetYearMonth.split('-').map(Number);
        return m < 3 ? String(y - 1) : String(y);
    }
}
