import { Component, inject } from '@angular/core';

import { ConfirmService } from '../services/confirm.service';

@Component({
    selector: 'app-confirm-dialog',
    standalone: true,
    templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
    private readonly confirmService = inject(ConfirmService);

    readonly dialog = this.confirmService.dialog;

    onBackdropClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            this.confirmService.answer(false);
        }
    }

    cancel(): void {
        this.confirmService.answer(false);
    }

    confirm(): void {
        this.confirmService.answer(true);
    }
}
