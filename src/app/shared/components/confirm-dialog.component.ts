import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { isValidAuthEmail, normalizeAuthEmail } from '../../features/auth/utils/email-link-auth.util';
import { ConfirmService } from '../services/confirm.service';

@Component({
    selector: 'app-confirm-dialog',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
    private readonly confirmService = inject(ConfirmService);

    readonly dialog = this.confirmService.dialog;
    emailValue = '';
    emailError = signal('');

    constructor() {
        effect(() => {
            const state = this.dialog();
            this.emailValue = state?.emailInput?.defaultValue ?? '';
            this.emailError.set('');
        });
    }

    onBackdropClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            this.cancel();
        }
    }

    cancel(): void {
        const state = this.dialog();
        if (!state) return;
        this.confirmService.answer(state.emailInput ? null : false);
    }

    confirm(): void {
        const state = this.dialog();
        if (!state) return;

        if (state.emailInput) {
            const email = normalizeAuthEmail(this.emailValue);
            if (!email) {
                this.emailError.set('メールアドレスを入力してください');
                return;
            }
            if (!isValidAuthEmail(email)) {
                this.emailError.set('メールアドレスの形式が正しくありません');
                return;
            }
            this.confirmService.answer(email);
            return;
        }

        this.confirmService.answer(true);
    }
}
