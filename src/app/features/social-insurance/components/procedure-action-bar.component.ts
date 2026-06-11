import { Component, computed, input, output, signal } from '@angular/core';

import { Procedure } from '../models/procedures.model';
import { dateLabel } from '../utils/procedure-display.util';

@Component({
    selector: 'app-procedure-action-bar',
    standalone: true,
    templateUrl: './procedure-action-bar.component.html',
})
export class ProcedureActionBarComponent {
    procedure = input.required<Procedure>();
    isSubmitting = input(false);
    submitDisabled = input(false);
    actionErrorMessage = input('');

    submitClick = output<void>();

    exportMessage = signal('');

    readonly dateLabel = dateLabel;

    isCompleted = computed(() => this.procedure().status === 'completed');

    submittedDateLabel(): string {
        const item = this.procedure();
        return dateLabel(item.submittedDate || item.completedDate);
    }

    onExport(): void {
        this.exportMessage.set('出力機能は準備中です。PDF・CSVなどの出力に対応予定です。');
    }
}
