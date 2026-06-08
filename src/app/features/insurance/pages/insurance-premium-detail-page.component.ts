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
    yearMonthFromTimestamp,
} from '../utils/reward-target-month.util';
import {
    FIXED_WAGE_FIELD_KEYS,
    FIXED_WAGE_FIELD_LABELS,
    FixedWageFieldKey,
} from '../utils/fixed-wage-change.util';
import { findLatestRegisteredRewardBefore } from '../utils/latest-reward.util';
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
import { OfficeService } from '../../company/services/office.service';
import { findCareInsuranceRate, findHealthInsuranceRate } from '../../insurance-rate/utils/insurance-rate-lookup.util';
import { KYOKAI_HEALTH_INSURANCE_RATE_FILES } from '../../insurance-rate/data/insurance-rates';
import { insuranceJoinStatus } from '../../social-insurance/models/social-insurance-status.model';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { roundInsurancePremium } from '../utils/insurance-premium-rounding.util';

type MonthRewardStatus = 'loading' | 'registered' | 'unregistered' | 'excluded';

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
    private readonly bonusRewardService = inject(BonusRewardService);

    standardReward = signal<StandardMonthlyReward | null>(null); // 標準報酬月額
    employeeRewards = signal<Record<string, StandardMonthlyReward>>({}); // 従業員の報酬月額
    healthInsuranceStartDate = signal<string | null>(null); // 健康保険の資格取得日
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
    // 対象年月
    targetYearMonth = signal<string>('');
    targetYearMonthLabel = computed(() => formatYearMonthLabel(this.targetYearMonth()));

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
            this.employeeRewards(),
            yearMonth,
            this.healthInsuranceStartDate(),
        );
    });

    // 月次報酬のステータス
    monthRewardStatus = computed((): MonthRewardStatus => {
        if (this.isLoadingMonth()) return 'loading';
        const employee = this.employee();
        const yearMonth = this.targetYearMonth();
        if (!employee || !yearMonth) return 'unregistered';
        if (!isRewardTargetMonth(employee, yearMonth)) return 'excluded';
        if (this.standardReward()) return 'registered';
        return 'unregistered';
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

        // フォームの合計を取得
        const monthlyReward = this.getMonthlyReward();

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
        return insuranceStatus === 'active' ? '対象' : insuranceStatus === 'inactive' ? '対象外' : '判定不可';
    }

    // 健康保険(厚生年金)加入判定(active: 対象, inactive: 対象外, unknown: 判定不可)
    healthInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return this.healthInsuranceStatus() ?? 'unknown';
    });

    // 厚生年金加入判定(active: 対象, inactive: 対象外, unknown: 判定不可)
    pensionInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return this.pensionInsuranceStatus() ?? 'unknown';
    });

    // 介護保険加入判定(active: 対象, inactive: 対象外, unknown: 判定不可)
    careInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return this.careInsuranceStatus() ?? 'unknown';
    });

    // 随時改定の判定
    revisionPreview = computed(() => {
        const ym = this.targetYearMonth();
        const employee = this.employee();
        if (!ym || !employee || !isRewardTargetMonth(employee, ym)) return null;

        const originMonth = addMonthsToYearMonth(ym, -2);
        const applyFromMonth = addMonthsToYearMonth(ym, 1);
        const calculationMonths = [
            originMonth,
            addMonthsToYearMonth(originMonth, 1),
            addMonthsToYearMonth(originMonth, 2),
        ];

        return {
            windowLabel: `${formatYearMonthLabel(originMonth)}〜${formatYearMonthLabel(ym)}`,
            applyFromLabel: formatYearMonthLabel(applyFromMonth),
            description: `${formatYearMonthLabel(originMonth)}〜${formatYearMonthLabel(ym)}の報酬をもとに、${formatYearMonthLabel(applyFromMonth)}から随時改定の対象になるか判定します。`,
            calculationMonths,
            originMonth,
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
            this.employeeRewards(),
            (monthlyReward) => this.calculator.calculate(monthlyReward),
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
            case 'registered':
                return '登録済み';
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
                await this.loadOffice();
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

    // 社会保険情報の読み込み
    async loadSocialInsuranceStatus() {
        const employeeId = this.employeeId();
        if (!employeeId) return;

        // 社会保険情報を取得
        const status = await this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employeeId);

        // 健康保険の資格取得日を設定
        this.healthInsuranceStartDate.set(status?.healthInsuranceStartDate ?? null);
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
            await Promise.all([this.loadStandardReward(), this.loadMonthBonuses()]);
        } finally {
            this.isLoadingMonth.set(false);
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

    // 月次報酬を保存
    async saveStandardMonthlyReward() {
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

        // ローディング
        this.isSaving.set(true);

        // エラーメッセージ
        this.errorMessage.set('');
        this.message.set('');

        try {
            const saved = await this.rewardService.upsert(this.buildInput());
            this.standardReward.set(saved);
            this.prefilledFromYearMonth.set(null);
            this.setFormFromStandardReward();
            this.employeeRewards.update((current) => ({
                ...current,
                [saved.targetYearMonth]: saved,
            }));
            this.message.set(`${saved.targetYearMonth} の報酬情報を保存しました`);
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
        return this.calculatePremium(this.applicableHealthStandardAmount(), this.healthInsuranceRate());
    });

    // 健康保険料（会社負担）
    healthInsuranceEmployerPremium = computed((): number | null => {
        return this.calculatePremium(
            this.applicableHealthStandardAmount(),
            this.healthInsuranceEmployerRate(),
        );
    });

    // 厚生年金料率
    pensionInsuranceRate = 0.0915;

    // 厚生年金料（本人負担）
    pensionInsurancePremium = computed((): number | null => {
        return this.calculatePremium(this.applicableHealthStandardAmount(), this.pensionInsuranceRate);
    });

    // 厚生年金料（会社負担）
    pensionInsuranceEmployerPremium = computed((): number | null => {
        return this.calculatePremium(this.applicableHealthStandardAmount(), this.pensionInsuranceRate);
    });

    // 介護保険料（本人負担）
    careInsurancePremium = computed((): number | null => {
        return this.calculatePremium(this.applicableHealthStandardAmount(), this.careInsuranceRate());
    });

    // 介護保険料（会社負担）
    careInsuranceEmployerPremium = computed((): number | null => {
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
        return this.calculatePremium(this.getPreviewStandardBonusAmount(), this.healthInsuranceRate());
    })

    // 厚生年金料（本人負担）
    pensionInsuranceBonusPremium = computed((): number | null => {
        return this.calculatePremium(this.getPreviewStandardBonusAmount(), this.pensionInsuranceRate);
    })

    // 介護保険料（本人負担）
    careInsuranceBonusPremium = computed((): number | null => {
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
}
