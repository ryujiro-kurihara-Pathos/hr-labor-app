import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

import { SalaryConditionFormValue } from '../models/salary-condition.model';
import { fixedWageTotalFromForm } from '../utils/salary-condition.util';

export type SalaryConditionModalSubmit = SalaryConditionFormValue;

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
    isLoading = input(false);
    serverErrorMessage = input('');

    close = output<void>();
    submit = output<SalaryConditionModalSubmit>();

    form: SalaryConditionFormValue = createEmptySalaryConditionForm();
    errorMessage = signal('');

    constructor() {
        effect(() => {
            const initial = this.initialValue();
            this.form = initial ? { ...initial } : createEmptySalaryConditionForm();
            this.errorMessage.set('');
        });
    }

    fixedWageTotal = (): number => fixedWageTotalFromForm(this.form);

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

        const fields: Array<keyof Pick<SalaryConditionFormValue,
            | 'basicSalary'
            | 'commutingAllowance'
            | 'positionAllowance'
            | 'housingAllowance'
            | 'fixedOvertimePay'
            | 'otherFixedAllowance'
        >> = [
            'basicSalary',
            'commutingAllowance',
            'positionAllowance',
            'housingAllowance',
            'fixedOvertimePay',
            'otherFixedAllowance',
        ];

        for (const key of fields) {
            if (this.form[key] === '') {
                this.errorMessage.set('各手当は0円以上で入力してください（該当なしは0）');
                return;
            }
            if (Number(this.form[key]) < 0) {
                this.errorMessage.set('各手当は0円以上で入力してください');
                return;
            }
        }

        if (this.fixedWageTotal() <= 0) {
            this.errorMessage.set('固定的賃金合計は1円以上にしてください');
            return;
        }

        this.errorMessage.set('');
        this.submit.emit({ ...this.form, effectiveStartMonth });
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
