import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

import { SalaryCondition } from '../models/salary-condition.model';
import { FIXED_WAGE_FIELD_KEYS, FIXED_WAGE_FIELD_LABELS } from '../utils/fixed-wage-change.util';
import {
    PART_TIME_SALARY_CONDITION_FIELD_KEYS,
    PART_TIME_SALARY_CONDITION_FIELD_LABELS,
    PART_TIME_SALARY_CONDITION_TOTAL_LABEL,
    partTimeSalaryConditionTotal,
} from '../utils/part-time-reward.util';
import { formatYearMonthLabel } from '../utils/standard-remuneration-determination.util';

type SalaryConditionFieldRow = {
    key: string;
    label: string;
    value: number;
};

@Component({
    selector: 'app-salary-condition-display',
    standalone: true,
    imports: [DecimalPipe],
    templateUrl: './salary-condition-display.component.html',
})
export class SalaryConditionDisplayComponent {
    condition = input.required<SalaryCondition>();
    showEffectiveMonth = input(false);
    showNote = input(true);
    showActions = input(false);
    compact = input(false);
    isPartTime = input(false);

    changeClick = output<void>();
    historyClick = output<void>();

    fieldRows = computed((): SalaryConditionFieldRow[] => {
        const condition = this.condition();
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
    });

    totalLabel = computed(() =>
        this.isPartTime() ? PART_TIME_SALARY_CONDITION_TOTAL_LABEL : '固定的賃金合計',
    );

    totalAmount = computed(() =>
        this.isPartTime()
            ? partTimeSalaryConditionTotal(this.condition())
            : this.condition().fixedWageTotal,
    );

    readonly formatYearMonthLabel = formatYearMonthLabel;
}
