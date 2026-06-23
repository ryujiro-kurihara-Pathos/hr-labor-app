import { Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { SalaryConditionPeriod } from '../models/salary-condition.model';
import { FIXED_WAGE_FIELD_LABELS, FIXED_WAGE_FIELD_KEYS } from '../utils/fixed-wage-change.util';
import {
    PART_TIME_SALARY_CONDITION_FIELD_KEYS,
    PART_TIME_SALARY_CONDITION_FIELD_LABELS,
    PART_TIME_SALARY_CONDITION_TOTAL_LABEL,
    partTimeSalaryConditionTotal,
} from '../utils/part-time-reward.util';

type SalaryConditionFieldRow = {
    key: string;
    label: string;
    value: number;
};

@Component({
    selector: 'app-salary-condition-history-modal',
    standalone: true,
    imports: [DecimalPipe],
    templateUrl: './salary-condition-history-modal.component.html',
})
export class SalaryConditionHistoryModalComponent {
    periods = input<SalaryConditionPeriod[]>([]);
    isPartTime = input(false);

    close = output<void>();

    totalLabel = computed(() =>
        this.isPartTime() ? PART_TIME_SALARY_CONDITION_TOTAL_LABEL : '固定的賃金合計',
    );

    onBackdropClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
            this.close.emit();
        }
    }

    onClose(): void {
        this.close.emit();
    }

    periodTotal(condition: SalaryConditionPeriod['condition']): number {
        return this.isPartTime()
            ? partTimeSalaryConditionTotal(condition)
            : condition.fixedWageTotal;
    }

    fieldRows(condition: SalaryConditionPeriod['condition']): SalaryConditionFieldRow[] {
        if (this.isPartTime()) {
            return PART_TIME_SALARY_CONDITION_FIELD_KEYS.map((key) => ({
                key,
                label: PART_TIME_SALARY_CONDITION_FIELD_LABELS[key],
                value: condition[key],
            }));
        }
        return FIXED_WAGE_FIELD_KEYS.map((key) => ({
            key,
            label: FIXED_WAGE_FIELD_LABELS[key],
            value: condition[key],
        }));
    }
}
