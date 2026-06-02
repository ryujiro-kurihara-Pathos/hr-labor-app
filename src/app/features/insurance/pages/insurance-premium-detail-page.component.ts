import { Component, signal, inject, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
import { isRewardTargetMonth, rewardTargetMonthReason } from '../utils/reward-target-month.util';
import { FIXED_WAGE_FIELD_LABELS, FixedWageFieldKey } from '../utils/fixed-wage-change.util';
import { findLatestRegisteredRewardBefore } from '../utils/latest-reward.util';
import { formatYearMonthLabel } from '../utils/standard-remuneration-determination.util';

@Component({
    selector: 'app-insurance-premium-detail-page',
    standalone: true,
    imports: [FormsModule, DecimalPipe],
    templateUrl: './insurance-premium-detail-page.component.html',
})
export class InsurancePremiumDetailPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly calculator = inject(StandardMonthlyRewardCalculatorService);
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly employeeService = inject(EmployeeService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);

    standardReward = signal<StandardMonthlyReward | null>(null);
    employeeRewards = signal<Record<string, StandardMonthlyReward>>({});
    healthInsuranceStartDate = signal<string | null>(null);

    rewardForm: RewardForm = {
        targetYearMonth: '',
        basicSalary: '',
        commutingAllowance: '',
        monthlyAllowance: '',
        positionAllowance: '',
        housingAllowance: '',
        fixedOvertimePay: '',
    };

    isLoading = signal(false);
    isSaving = signal(false);
    errorMessage = signal<string>('');
    message = signal<string>('');

    employeeId = signal<string>('');
    employee = signal<Employee | null>(null);
    targetYearMonth = signal<string>('');
    /** 未入力月を開いたとき、初期表示に使った直近登録済み月（YYYY-MM） */
    prefilledFromYearMonth = signal<string | null>(null);

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

    async loadSocialInsuranceStatus() {
        const employeeId = this.employeeId();
        if (!employeeId) return;

        const status = await this.socialInsuranceStatusService.getByEmployeeId(employeeId);
        this.healthInsuranceStartDate.set(status?.healthInsuranceStartDate ?? null);
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
        this.setTargetYearMonth(yearMonth);
        this.message.set('');
        await this.loadStandardReward();
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
}
