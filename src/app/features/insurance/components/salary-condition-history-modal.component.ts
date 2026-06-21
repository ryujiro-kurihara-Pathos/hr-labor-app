import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { SalaryConditionPeriod } from '../models/salary-condition.model';
import { FIXED_WAGE_FIELD_LABELS, FIXED_WAGE_FIELD_KEYS } from '../utils/fixed-wage-change.util';

@Component({
    selector: 'app-salary-condition-history-modal',
    standalone: true,
    imports: [DecimalPipe],
    templateUrl: './salary-condition-history-modal.component.html',
})
export class SalaryConditionHistoryModalComponent {
    periods = input<SalaryConditionPeriod[]>([]);

    close = output<void>();

    readonly fieldKeys = FIXED_WAGE_FIELD_KEYS;
    readonly fieldLabels = FIXED_WAGE_FIELD_LABELS;

    onBackdropClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
            this.close.emit();
        }
    }

    onClose(): void {
        this.close.emit();
    }
}
