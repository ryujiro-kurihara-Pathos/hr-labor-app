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
    yearMonthFromDateString,
} from '../utils/reward-target-month.util';
import {
    FIXED_WAGE_FIELD_KEYS,
    FIXED_WAGE_FIELD_LABELS,
    FixedWageFieldKey,
} from '../utils/fixed-wage-change.util';
import { findLatestRegisteredRewardBefore } from '../utils/latest-reward.util';
import { confirmedRewardsByYearMonth, normalizeRewardStatus } from '../utils/reward-status.util';
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
import { formatPayrollDeductionNote } from '../../company/utils/company-payroll-settings.util';
import { OfficeService } from '../../company/services/office.service';
import { findCareInsuranceRate, findHealthInsuranceRate } from '../../insurance-rate/utils/insurance-rate-lookup.util';
import { KYOKAI_HEALTH_INSURANCE_RATE_FILES } from '../../insurance-rate/data/insurance-rates';
import { insuranceJoinStatus } from '../../social-insurance/models/social-insurance-status.model';
import { insuranceJoinStatusLabel } from '../../social-insurance/utils/social-insurance-status-display.util';
import {
    isCareInsurancePremiumTargetMonth,
    judgeCareInsuranceStatus,
} from '../../social-insurance/utils/care-insurance-period.util';
import { isInsurancePremiumTargetMonth } from '../../social-insurance/utils/insurance-premium-period.util';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import {
    bonusesForStandardBonusPremium,
    effectiveMonthlyRewardFromBase,
    monthlyBonusRemunerationAddition,
    shouldTreatBonusAsMonthlyRemuneration,
    sumBonusAmountInTargetPeriod,
} from '../utils/effective-monthly-reward.util';
import { roundInsurancePremium } from '../utils/insurance-premium-rounding.util';
import { SocialInsuranceProcedureService } from '../../social-insurance/services/social-insurance-procedure.service';
import { Procedure, ProcedureStatus } from '../../social-insurance/models/procedures.model';
import { procedureStatusLabel } from '../../social-insurance/utils/procedure-display.util';

type MonthRewardStatus = 'loading' | 'draft' | 'confirmed' | 'unregistered' | 'excluded';

@Component({
    selector: 'app-insurance-premium-detail-page',
    standalone: true,
    imports: [FormsModule, DecimalPipe, RouterLink],
    templateUrl: './insurance-premium-detail-page.component.html',
})
export class InsurancePremiumDetailPageComponent {
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

    standardReward = signal<StandardMonthlyReward | null>(null); // 標準報酬月額
    employeeRewards = signal<Record<string, StandardMonthlyReward>>({}); // 従業員の報酬月額
    healthInsuranceStartDate = signal<string | null>(null); // 健康保険の資格取得日
    healthInsuranceEndDate = signal<string | null>(null); // 健康保険の資格喪失日
    healthInsuranceStatus = signal<insuranceJoinStatus | null>(null); // 健康保険の加入判定
    pensionInsuranceStatus = signal<insuranceJoinStatus | null>(null); // 厚生年金の加入判定
    careInsuranceStatus = signal<insuranceJoinStatus | null>(null); // 介護保険の加入判定

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
    isLoadingBonus = signal(false);
    isSavingBonus = signal(false);
    // メッセージ
    errorMessage = signal<string>('');
    message = signal<string>('');
    bonusMessage = signal<string>('');
    bonusErrorMessage = signal<string>('');

    // 従業員
    employeeId = signal<string>('');
    employee = signal<Employee | null>(null);
    // 事業所
    office = signal<Office | null>(null);
    company = signal<Company | null>(null);
    insurancePremiumCollectionTiming = signal<InsurancePremiumCollectionTiming>('next_month');
    // 対象年月
    targetYearMonth = signal<string>('');
    targetYearMonthLabel = computed(() => formatYearMonthLabel(this.targetYearMonth()));

    payrollDeductionNote = computed(() => {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return '';
        return formatPayrollDeductionNote(targetYearMonth, this.insurancePremiumCollectionTiming());
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
            confirmedRewardsByYearMonth(this.employeeRewards()),
            yearMonth,
            this.healthInsuranceStartDate(),
            this.employeeBonuses(),
        );
    });

    /** 対象月の暦年で賞与が年4回以上の場合、報酬月額に算入する */
    treatBonusAsMonthlyRemuneration = computed(() => {
        const yearMonth = this.targetYearMonth();
        if (!yearMonth) return false;
        return shouldTreatBonusAsMonthlyRemuneration(this.employeeBonuses(), yearMonth);
    });

    /** 標準賞与額・賞与保険料の対象（年4回以上の場合は除外） */
    bonusesForPremium = computed(() => {
        const yearMonth = this.targetYearMonth();
        if (!yearMonth) return [];
        return bonusesForStandardBonusPremium(
            this.monthBonuses(),
            yearMonth,
            this.employeeBonuses(),
        );
    });

    /** 報酬月額に算入した賞与額（対象期間の賞与合計 ÷ 12） */
    includedBonusInMonth = computed(() => {
        if (!this.treatBonusAsMonthlyRemuneration()) return 0;
        const yearMonth = this.targetYearMonth();
        if (!yearMonth) return 0;
        return monthlyBonusRemunerationAddition(this.employeeBonuses(), yearMonth);
    });

    /** 対象期間内の賞与支給額合計（算入表示用） */
    bonusTotalInTargetPeriod = computed(() => {
        const yearMonth = this.targetYearMonth();
        if (!yearMonth) return 0;
        return sumBonusAmountInTargetPeriod(this.employeeBonuses(), yearMonth);
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

    /** 下書きまたは未登録のときのみフォームを編集可能 */
    isRewardEditable = computed(() => {
        const status = this.monthRewardStatus();
        return status === 'unregistered' || status === 'draft';
    });

    // 月次報酬の登録済み報酬月額
    registeredMonthlyReward = computed(() => {
        const reward = this.standardReward();
        if (!reward) return null;
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
            this.employeeBonuses(),
        );

        // 在籍日数を取得
        const paymentBaseDays = this.paymentBaseDays();
        if (paymentBaseDays === null) return null;

        // その月の日数を取得
        const targetYear = Number(targetYearMonth.split('-')[0]);
        const targetMonth = Number(targetYearMonth.split('-')[1]);
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

        // 在籍日数がその月の日数と同じ場合
        if(paymentBaseDays === daysInMonth) {
            return monthlyReward > 0 ? monthlyReward : null;
        }

        // 在籍日数から日割り計算
        const dailyReward = monthlyReward * paymentBaseDays / daysInMonth;

        return dailyReward > 0 ? Math.round(dailyReward) : null;
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

    // 健康保険(厚生年金)加入判定(active: 対象, inactive: 対象外, unknown: 判定不可)
    healthInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return this.healthInsuranceStatus() ?? 'unknown';
    });

    // 厚生年金加入判定(active: 対象, inactive: 対象外, unknown: 判定不可)
    pensionInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return this.pensionInsuranceStatus() ?? 'unknown';
    });

    isHealthPremiumMonth = computed((): boolean => {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return false;
        return isInsurancePremiumTargetMonth(
            targetYearMonth,
            this.healthInsuranceStartDate(),
            this.healthInsuranceEndDate(),
        );
    });

    isCarePremiumMonth = computed((): boolean => {
        const employee = this.employee();
        const targetYearMonth = this.targetYearMonth();
        if (!employee || !targetYearMonth) return false;
        return isCareInsurancePremiumTargetMonth(
            targetYearMonth,
            this.healthInsuranceStartDate(),
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

        const qualificationDate = getQualificationDate(employee, this.healthInsuranceStartDate());
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
            this.employeeBonuses(),
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

        const qualificationDate = getQualificationDate(employee, this.healthInsuranceStartDate());
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
                return '下書きとして保存されています。確定するまで編集できます。';
            case 'confirmed':
                return '確定済みのため編集できません。';
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

        // 健康保険の資格取得日・喪失日を設定
        this.healthInsuranceStartDate.set(status?.healthInsuranceStartDate ?? null);
        this.healthInsuranceEndDate.set(status?.healthInsuranceEndDate ?? null);
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
        this.rewardForm = {
            targetYearMonth: this.targetYearMonth(),
            basicSalary: reward.basicSalary,
            commutingAllowance: reward.commutingAllowance,
            positionAllowance: reward.positionAllowance,
            housingAllowance: reward.housingAllowance,
            fixedOvertimePay: reward.fixedOvertimePay,
            otherFixedAllowance: reward.otherFixedAllowance,
            overtimePay: reward.overtimePay,
            holidayPay: reward.holidayPay,
            nightPay: reward.nightPay,
            commissionPay: reward.commissionPay,
            otherVariablePay: reward.otherVariablePay,
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
        return {
            companyId: employee.companyId,
            employeeId: this.employeeId(),
            targetYearMonth: this.targetYearMonth(),
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
            healthInsuranceGrade: 0,
            healthInsuranceStandardMonthlyAmount: 0,
            pensionInsuranceGrade: 0,
            pensionInsuranceStandardMonthlyAmount: 0,
        };
    }

    async saveDraftStandardMonthlyReward() {
        await this.persistStandardMonthlyReward('draft');
    }

    async confirmStandardMonthlyReward() {
        await this.persistStandardMonthlyReward('confirmed');
    }

    private async persistStandardMonthlyReward(mode: 'draft' | 'confirmed') {
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

        this.isSaving.set(true);
        this.errorMessage.set('');
        this.message.set('');

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
            this.message.set(
                mode === 'draft'
                    ? `${saved.targetYearMonth} の報酬情報を下書き保存しました`
                    : `${saved.targetYearMonth} の報酬情報を確定しました`,
            );
        } catch (error) {
            console.error('保存に失敗しました', error);
            const msg = error instanceof Error ? error.message : '保存に失敗しました';
            this.errorMessage.set(msg);
        } finally {
            this.isSaving.set(false);
        }
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

    /** この月に適用される健康保険の標準報酬月額 */
    applicableHealthStandardAmount = computed((): number | null => {
        const targetYearMonth = this.targetYearMonth();
        this.standardReward();
        this.employeeRewards();
        if (this.isLoadingMonth() || !targetYearMonth) return null;

        const effective = this.effectiveStandard();
        if (!effective?.isComplete || !effective.calculation?.health) return null;

        return effective.calculation.health.standardMonthlyAmount;
    });

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
        if (!this.isHealthPremiumMonth()) return null;
        return this.calculatePremium(this.applicableHealthStandardAmount(), this.pensionInsuranceRate);
    });

    // 厚生年金料（会社負担）
    pensionInsuranceEmployerPremium = computed((): number | null => {
        if (!this.isHealthPremiumMonth()) return null;
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

    selectBonusForEdit(bonus: BonusReward) {
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

    // 賞与を保存
    async saveBonusReward() {
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
            await this.bonusRewardService.upsertBonusReward({
                companyId: employee.companyId,
                employeeId,
                paymentDate,
                targetYearMonth,
                bonusAmount,
            });
            await this.loadMonthBonuses();
            await this.loadBonusPaymentProcedure();
            this.bonusMessage.set('賞与を保存しました');
            this.resetBonusForm();
            this.isBonusFormVisible.set(this.monthBonuses().length === 0);
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
        const bonus = this.monthBonuses().find((bonus) => {
            return bonus.paymentDate === this.bonusForm.paymentDate;
        });
        if(!bonus) return null;
        const amount = this.toNumber(bonus.bonusAmount);
        if (amount <= 0) return null;
        return this.bonusRewardService.calculateStandardBonusAmount(amount);
    }

    // 賞与に対する保険料
    // 健康保険料（本人負担）
    healthInsuranceBonusPremium = computed((): number | null => {
        if (!this.isHealthPremiumMonth()) return null;
        return this.calculatePremium(this.getPreviewStandardBonusAmount(), this.healthInsuranceRate());
    })

    // 厚生年金料（本人負担）
    pensionInsuranceBonusPremium = computed((): number | null => {
        if (!this.isHealthPremiumMonth()) return null;
        return this.calculatePremium(this.getPreviewStandardBonusAmount(), this.pensionInsuranceRate);
    })

    // 介護保険料（本人負担）
    careInsuranceBonusPremium = computed((): number | null => {
        if (!this.isCarePremiumMonth()) return null;
        return this.calculatePremium(this.getPreviewStandardBonusAmount(), this.careInsuranceRate());
    })

    // 賞与に対する社会保険料の合計（本人負担）
    socialInsuranceBonusPremium = computed((): number | null => {
        const healthPremium = this.healthInsuranceBonusPremium() ?? 0;
        const pensionPremium = this.pensionInsuranceBonusPremium() ?? 0;
        const carePremium = this.careInsuranceBonusPremium() ?? 0;
        return healthPremium + pensionPremium + carePremium;
    })

    // 社会保険料の合計（本人負担）
    socialInsuranceTotalPremium = computed((): number | null => {
        const socialInsurancePremium = this.socialInsurancePremium() ?? 0;
        const socialInsuranceBonusPremium = this.socialInsuranceBonusPremium() ?? 0;
        return socialInsurancePremium + socialInsuranceBonusPremium;
    })

    insuranceRatePercentLabel(rate: number | null): string | null {
        if (rate === null) return null;
        return Number((rate * 100).toFixed(3)).toString();
    }

    private healthInsuranceFiscalYear(targetYearMonth: string): string {
        const [y, m] = targetYearMonth.split('-').map(Number);
        return m < 3 ? String(y - 1) : String(y);
    }

    private healthInsuranceRateRow() {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return null;

        const fiscalYear = this.healthInsuranceFiscalYear(targetYearMonth);
        const fileName = `kyokai-health-insurance-rates-${fiscalYear}-03.ts`;
        const rates =
            KYOKAI_HEALTH_INSURANCE_RATE_FILES.find((file) => file.fileName === fileName)?.rates ?? [];

        return findHealthInsuranceRate({
            rates,
            targetYearMonth,
            providerType: this.office()?.healthInsuranceType ?? 'kyokai',
            prefecture: this.office()?.prefecture ?? null,
        });
    }

    private careInsuranceRateRow() {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return null;

        return findCareInsuranceRate(targetYearMonth);
    }

    // 保険料を計算
    private calculatePremium(amount: number | null, rate: number | null): number | null {
        const targetYearMonth = this.targetYearMonth();
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
