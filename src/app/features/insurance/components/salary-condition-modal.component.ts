import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

import { SalaryConditionFormValue } from '../models/salary-condition.model';
import {
    normalizePartTimeSalaryConditionForm,
    PART_TIME_SALARY_CONDITION_FIELD_KEYS,
    PART_TIME_SALARY_CONDITION_TOTAL_LABEL,
    partTimeMonthlyRewardTotal,
} from '../utils/part-time-reward.util';
import { fixedWageTotalFromForm } from '../utils/salary-condition.util';
import { FIXED_WAGE_FIELD_KEYS } from '../utils/fixed-wage-change.util';

export type SalaryConditionModalSubmit = SalaryConditionFormValue;

type SalaryConditionAmountField = keyof Pick<SalaryConditionFormValue,
    | 'basicSalary'
    | 'commutingAllowance'
    | 'positionAllowance'
    | 'housingAllowance'
    | 'fixedOvertimePay'
    | 'otherFixedAllowance'
>;

@Component({
    selector: 'app-salary-condition-modal',
    standalone: true,
    imports: [FormsModule, DecimalPipe],
    templateUrl: './salary-condition-modal.component.html',
})
export class SalaryConditionModalComponent {
    title = input('給与条件を登録');
    initialValue = input<SalaryConditionFormValue | null>(null);
    minEffectiveStartMonth = input<string | null>(null);
    isPartTime = input(false);
    isLoading = input(false);
    serverErrorMessage = input('');

    close = output<void>();
    submit = output<SalaryConditionModalSubmit>();

    form: SalaryConditionFormValue = createEmptySalaryConditionForm();
    errorMessage = signal('');

    totalLabel = computed(() =>
        this.isPartTime() ? PART_TIME_SALARY_CONDITION_TOTAL_LABEL : '固定的賃金合計',
    );

    constructor() {
        effect(() => {
            const initial = this.initialValue();
            this.form = initial ? { ...initial } : createEmptySalaryConditionForm();
            this.errorMessage.set('');
        });
    }

    fixedWageTotal = (): number => {
        if (this.isPartTime()) {
            return partTimeMonthlyRewardTotal(
                toNumber(this.form.basicSalary),
                toNumber(this.form.commutingAllowance),
                toNumber(this.form.otherFixedAllowance),
            );
        }
        return fixedWageTotalFromForm(this.form);
    };

    onBackdropClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
            this.close.emit();
        }
    }

    onCancel(): void {
        this.close.emit();
    }

    onSubmit(): void {
        const effectiveStartMonth = this.form.effectiveStartMonth.trim();
        if (!effectiveStartMonth) {
            this.errorMessage.set('適用開始月を選択してください');
            return;
        }

        const fields: SalaryConditionAmountField[] = this.isPartTime()
            ? [...PART_TIME_SALARY_CONDITION_FIELD_KEYS]
            : [...FIXED_WAGE_FIELD_KEYS];

        for (const key of fields) {
            if (this.form[key] === '') {
                this.errorMessage.set(
                    this.isPartTime()
                        ? '各項目は0円以上で入力してください（該当なしは0）'
                        : '各手当は0円以上で入力してください（該当なしは0）',
                );
                return;
            }
            if (Number(this.form[key]) < 0) {
                this.errorMessage.set('各項目は0円以上で入力してください');
                return;
            }
        }

        if (this.isPartTime() && this.form.basicSalary === '') {
            this.errorMessage.set('月額報酬を入力してください');
            return;
        }

        if (this.fixedWageTotal() <= 0) {
            this.errorMessage.set(
                this.isPartTime()
                    ? '見込み給料は1円以上にしてください'
                    : '固定的賃金合計は1円以上にしてください',
            );
            return;
        }

        this.errorMessage.set('');
        const payload = this.isPartTime()
            ? normalizePartTimeSalaryConditionForm({ ...this.form, effectiveStartMonth })
            : { ...this.form, effectiveStartMonth };
        this.submit.emit(payload);
    }

    displayErrorMessage(): string {
        return this.errorMessage() || this.serverErrorMessage();
    }
}

function createEmptySalaryConditionForm(): SalaryConditionFormValue {
    return {
        effectiveStartMonth: '',
        basicSalary: '',
        commutingAllowance: 0,
        positionAllowance: 0,
        housingAllowance: 0,
        fixedOvertimePay: 0,
        otherFixedAllowance: 0,
        note: '',
        changeReason: '',
    };
}

function toNumber(value: number | ''): number {
    if (value === '') return 0;
    return Number.isFinite(value) ? value : 0;
}
