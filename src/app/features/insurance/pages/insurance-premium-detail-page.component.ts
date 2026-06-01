import { Component, signal, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
    StandardMonthlyReward,
    RewardForm,
    StandardMonthlyRewardInput,
} from '../models/standard-monthly-reward.model';
import {
    StandardMonthlyRewardCalculation,
    StandardMonthlyRewardCalculatorService,
} from '../services/standard-monthly-reward-calculator.service';
import { StandardMonthlyRewardService } from '../services/standard-monthly-reward.service';
import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';

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
    private readonly employeeService = inject(EmployeeService);

    standardReward = signal<StandardMonthlyReward | null>(null);

    rewardForm: RewardForm = {
        targetYearMonth: '',
        basicSalary: 0,
        commutingAllowance: 0,
        monthlyAllowance: 0,
        positionAllowance: 0,
        housingAllowance: 0,
        fixedOvertimePay: 0,
    };

    isLoading = signal(false);
    isSaving = signal(false);
    errorMessage = signal<string>('');
    message = signal<string>('');

    employeeId = signal<string>('');
    employee = signal<Employee | null>(null);

    async ngOnInit() {
        this.isLoading.set(true);
        this.errorMessage.set('');
        this.employeeId.set(this.route.snapshot.params['employeeId'] ?? '');

        const ym = this.route.snapshot.queryParams['ym'] as string | undefined;
        this.rewardForm.targetYearMonth =
            ym && /^\d{4}-\d{2}$/.test(ym) ? ym : this.currentYearMonth();

        try {
            await this.loadEmployee();
            if (this.employee()) {
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

    async onTargetYearMonthChange() {
        await this.loadStandardReward();
    }

    async loadStandardReward() {
        const employeeId = this.employeeId();
        const targetYearMonth = this.rewardForm.targetYearMonth;
        if (!employeeId || !targetYearMonth) return;

        this.errorMessage.set('');
        try {
            const standardReward = await this.rewardService.getByEmployeeAndMonth(
                employeeId,
                targetYearMonth,
            );
            this.standardReward.set(standardReward);
            if (standardReward) {
                this.setFormFromStandardReward();
            } else {
                this.resetRewardFieldsKeepMonth();
            }
        } catch (error) {
            console.error('標準報酬月額の取得に失敗しました', error);
            this.errorMessage.set('標準報酬月額の取得に失敗しました');
        }
    }

    setFormFromStandardReward() {
        const standardReward = this.standardReward();
        if (!standardReward) return;

        this.rewardForm = {
            targetYearMonth: standardReward.targetYearMonth,
            basicSalary: standardReward.basicSalary,
            commutingAllowance: standardReward.commutingAllowance,
            monthlyAllowance: standardReward.monthlyAllowance,
            positionAllowance: standardReward.positionAllowance,
            housingAllowance: standardReward.housingAllowance,
            fixedOvertimePay: standardReward.fixedOvertimePay,
        };
    }

    private resetRewardFieldsKeepMonth() {
        const ym = this.rewardForm.targetYearMonth;
        this.rewardForm = {
            targetYearMonth: ym,
            basicSalary: 0,
            commutingAllowance: 0,
            monthlyAllowance: 0,
            positionAllowance: 0,
            housingAllowance: 0,
            fixedOvertimePay: 0,
        };
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
        return {
            employeeId: this.employeeId(),
            targetYearMonth: this.rewardForm.targetYearMonth,
            basicSalary: this.toNumber(this.rewardForm.basicSalary),
            commutingAllowance: this.toNumber(this.rewardForm.commutingAllowance),
            monthlyAllowance: this.toNumber(this.rewardForm.monthlyAllowance),
            positionAllowance: this.toNumber(this.rewardForm.positionAllowance),
            housingAllowance: this.toNumber(this.rewardForm.housingAllowance),
            fixedOvertimePay: this.toNumber(this.rewardForm.fixedOvertimePay),
        };
    }

    async saveStandardMonthlyReward() {
        const employeeId = this.employeeId();
        if (!employeeId) return;
        if (!this.rewardForm.targetYearMonth) {
            this.errorMessage.set('対象年月を選択してください');
            return;
        }

        this.isSaving.set(true);
        this.errorMessage.set('');
        this.message.set('');

        try {
            const saved = await this.rewardService.upsert(this.buildInput());
            this.standardReward.set(saved);
            this.setFormFromStandardReward();
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
