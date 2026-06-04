import { Component, signal, inject, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
import { addMonthsToYearMonth, isRewardTargetMonth, rewardTargetMonthReason } from '../utils/reward-target-month.util';
import { FIXED_WAGE_FIELD_LABELS, FixedWageFieldKey } from '../utils/fixed-wage-change.util';
import { findLatestRegisteredRewardBefore } from '../utils/latest-reward.util';
import {
    formatYearMonthLabel,
    getFirstRegularDeterminationYearMonth,
    getQualificationDate,
} from '../utils/standard-remuneration-determination.util';
import {
    evaluateRevisionAtOrigin,
    formatRevisionGradeComparison,
} from '../utils/determination-precedence.util';
import { yearMonthFromDateString } from '../utils/reward-target-month.util';
import { Office } from '../../company/models/office.model';
import { OfficeService } from '../../company/services/office.service';
import { findHealthInsuranceRate } from '../../insurance-rate/utils/insurance-rate-lookup.util';
import { KYOKAI_HEALTH_INSURANCE_RATE_FILES } from '../../insurance-rate/data/insurance-rates';
import { insuranceJoinStatus } from '../../social-insurance/models/social-insurance-status.model';

type MonthRewardStatus = 'loading' | 'registered' | 'unregistered' | 'excluded';

@Component({
    selector: 'app-insurance-premium-detail-page',
    standalone: true,
    imports: [FormsModule, DecimalPipe],
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

    standardReward = signal<StandardMonthlyReward | null>(null); // 標準報酬月額
    employeeRewards = signal<Record<string, StandardMonthlyReward>>({}); // 従業員の報酬月額
    healthInsuranceStartDate = signal<string | null>(null); // 健康保険の資格取得日
    healthInsuranceStatus = signal<insuranceJoinStatus | null>(null); // 健康保険の加入判定


    // 報酬フォーム
    rewardForm: RewardForm = {
        targetYearMonth: '',
        basicSalary: '',
        commutingAllowance: '',
        monthlyAllowance: '',
        positionAllowance: '',
        housingAllowance: '',
        fixedOvertimePay: '',
    };

    // ローディング
    isLoading = signal(false);
    isLoadingMonth = signal(false);
    isSaving = signal(false);
    // メッセージ
    errorMessage = signal<string>('');
    message = signal<string>('');

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

    monthRewardStatus = computed((): MonthRewardStatus => {
        if (this.isLoadingMonth()) return 'loading';
        const employee = this.employee();
        const yearMonth = this.targetYearMonth();
        if (!employee || !yearMonth) return 'unregistered';
        if (!isRewardTargetMonth(employee, yearMonth)) return 'excluded';
        if (this.standardReward()) return 'registered';
        return 'unregistered';
    });

    registeredMonthlyReward = computed(() => {
        const reward = this.standardReward();
        if (!reward) return null;
        return this.sumRewardFields(reward);
    });

    /** 対象月の報酬月額（手当合計。保存済みは DB、未保存はフォーム） */
    targetMonthMonthlyReward = computed((): number | null => {
        this.formRewardRevision();
        const targetYearMonth = this.targetYearMonth();
        if (this.isLoadingMonth() || !targetYearMonth) return null;

        const saved = this.standardReward();
        if (saved) return this.sumRewardFields(saved);

        const fromForm = this.getMonthlyReward();
        return fromForm > 0 ? fromForm : null;
    });

    // 社会保険加入判定の日本語表示（対象, 対象外, 判定不可）
    displayInsuranceStatus(insuranceStatus: insuranceJoinStatus): string {
        return insuranceStatus === 'active' ? '対象' : insuranceStatus === 'inactive' ? '対象外' : '判定不可';
    }

    // 健康保険(厚生年金)加入判定(active: 対象, inactive: 対象外, unknown: 判定不可)
    healthInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return this.healthInsuranceStatus() ?? 'unknown';
    });

    // 介護保険加入判定(active: 対象, inactive: 対象外, unknown: 判定不可)
    careInsuranceJoinStatus = computed((): insuranceJoinStatus => {
        return 'unknown';
    })

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

    async ngOnInit() {
        this.isLoading.set(true);
        this.errorMessage.set('');
        this.employeeId.set(this.route.snapshot.params['employeeId'] ?? '');

        const yearMonth = this.route.snapshot.queryParams['ym'] as string | undefined;
        const initialYearMonth =
            yearMonth && /^\d{4}-\d{2}$/.test(yearMonth) ? yearMonth : this.currentYearMonth();
        this.setTargetYearMonth(initialYearMonth);

        try {
            await this.loadEmployee();
            if (this.employee()) {
                await Promise.all([this.loadEmployeeRewards(), this.loadSocialInsuranceStatus()]);
                await this.loadStandardReward();
                await this.loadOffice();
            }
        } finally {
            this.isLoading.set(false);
        }
    }

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

    async loadSocialInsuranceStatus() {
        const employeeId = this.employeeId();
        if (!employeeId) return;

        const status = await this.socialInsuranceStatusService.getByEmployeeId(employeeId);
        this.healthInsuranceStartDate.set(status?.healthInsuranceStartDate ?? null);
        this.healthInsuranceStatus.set(status?.healthInsuranceStatus ?? null);
    }

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

        this.isLoadingMonth.set(true);
        try {
            await this.loadStandardReward();
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
            monthlyAllowance: reward.monthlyAllowance,
            positionAllowance: reward.positionAllowance,
            housingAllowance: reward.housingAllowance,
            fixedOvertimePay: reward.fixedOvertimePay,
        };
    }

    private resetRewardFieldsKeepMonth() {
        const ym = this.targetYearMonth();
        this.rewardForm = {
            targetYearMonth: ym,
            basicSalary: '',
            commutingAllowance: '',
            monthlyAllowance: '',
            positionAllowance: '',
            housingAllowance: '',
            fixedOvertimePay: '',
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
            form.monthlyAllowance,
            form.positionAllowance,
            form.housingAllowance,
            form.fixedOvertimePay,
        ];
    }

    getMonthlyReward(): number {
        const form = this.rewardForm;
        return (
            this.toNumber(form.basicSalary) +
            this.toNumber(form.commutingAllowance) +
            this.toNumber(form.monthlyAllowance) +
            this.toNumber(form.positionAllowance) +
            this.toNumber(form.housingAllowance) +
            this.toNumber(form.fixedOvertimePay)
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
        | 'monthlyAllowance'
        | 'positionAllowance'
        | 'housingAllowance'
        | 'fixedOvertimePay'
    >): number {
        return (
            reward.basicSalary +
            reward.commutingAllowance +
            reward.monthlyAllowance +
            reward.positionAllowance +
            reward.housingAllowance +
            reward.fixedOvertimePay
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
            monthlyAllowance: this.toNumber(this.rewardForm.monthlyAllowance),
            positionAllowance: this.toNumber(this.rewardForm.positionAllowance),
            housingAllowance: this.toNumber(this.rewardForm.housingAllowance),
            fixedOvertimePay: this.toNumber(this.rewardForm.fixedOvertimePay),
            healthInsuranceGrade: 0,
            healthInsuranceStandardMonthlyAmount: 0,
            pensionInsuranceGrade: 0,
            pensionInsuranceStandardMonthlyAmount: 0,
        };
    }

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

    // 対象年月に対応する協会けんぽ料率行
    healthInsuranceRateRow = computed(() => {
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
    });

    // 健康保険料率（本人負担・小数
    healthInsuranceRate = computed((): number | null => {
        return this.healthInsuranceRateRow()?.employeeRate ?? null;
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
        const targetYearMonth = this.targetYearMonth();
        this.standardReward();
        this.employeeRewards();
        if (this.isLoadingMonth() || !targetYearMonth) return null;

        const amount = this.applicableHealthStandardAmount();
        const rateRow = this.healthInsuranceRateRow();
        if (amount === null || !rateRow) return null;

        return Math.round(amount * rateRow.employeeRate);
    });

    // 厚生年金料率
    pensionInsuranceRate = 9.15;

    // 厚生年金料（本人負担）
    pensionInsurancePremium = computed((): number | null => {
        const amount = this.applicableHealthStandardAmount();
        if (!amount) return null;
        const insuranceRate = this.pensionInsuranceRate;
        return Math.round(amount * insuranceRate / 100);
    })

    healthInsuranceRatePercentLabel(): string | null {
        const rate = this.healthInsuranceRate();
        if (rate === null) return null;
        return (rate * 100).toFixed(2);
    }

    private healthInsuranceFiscalYear(targetYearMonth: string): string {
        const [y, m] = targetYearMonth.split('-').map(Number);
        return m < 3 ? String(y - 1) : String(y);
    }

    private bumpFormRewardRevision(): void {
        this.formRewardRevision.update((v) => v + 1);
    }
}
