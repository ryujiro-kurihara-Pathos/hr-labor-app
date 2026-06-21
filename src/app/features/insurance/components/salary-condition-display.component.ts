import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { SalaryCondition } from '../models/salary-condition.model';
import { FIXED_WAGE_FIELD_KEYS, FIXED_WAGE_FIELD_LABELS } from '../utils/fixed-wage-change.util';
import { formatYearMonthLabel } from '../utils/standard-remuneration-determination.util';

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

    changeClick = output<void>();
    historyClick = output<void>();

    readonly fieldKeys = FIXED_WAGE_FIELD_KEYS;
    readonly fieldLabels = FIXED_WAGE_FIELD_LABELS;
    readonly formatYearMonthLabel = formatYearMonthLabel;
}
