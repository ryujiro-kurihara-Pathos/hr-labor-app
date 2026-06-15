import { Injectable, signal } from '@angular/core';

export type ConfirmEmailInputOptions = {
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    note?: string;
};

export type ConfirmDialogOptions = {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    emailInput?: ConfirmEmailInputOptions;
};

type ConfirmDialogState = ConfirmDialogOptions & {
    resolve: (value: boolean | string | null) => void;
};

@Injectable({
    providedIn: 'root',
})
export class ConfirmService {
    readonly dialog = signal<ConfirmDialogState | null>(null);

    confirm(message: string, options: Omit<ConfirmDialogOptions, 'message'> = {}): Promise<boolean> {
        return new Promise((resolve) => {
            this.dialog.set({
                message,
                confirmLabel: options.confirmLabel ?? 'OK',
                cancelLabel: options.cancelLabel ?? 'キャンセル',
                danger: options.danger ?? false,
                resolve: (value) => resolve(value === true),
            });
        });
    }

    confirmLogout(): Promise<boolean> {
        return this.confirm('ログアウトしますか？', {
            confirmLabel: 'ログアウト',
            cancelLabel: 'キャンセル',
            danger: true,
        });
    }

    confirmDelete(): Promise<boolean> {
        return this.confirm('削除しますか？', {
            confirmLabel: '削除',
            cancelLabel: 'キャンセル',
            danger: true,
        });
    }

    confirmSubmit(): Promise<boolean> {
        return this.confirm('提出しますか？', {
            confirmLabel: '提出する',
            cancelLabel: 'キャンセル',
        });
    }

    confirmInviteEmail(defaultEmail = ''): Promise<string | null> {
        return new Promise((resolve) => {
            this.dialog.set({
                message: '招待メールを送信しますか？',
                confirmLabel: '送信する',
                cancelLabel: '後でにする',
                emailInput: {
                    label: '送信先メールアドレス',
                    placeholder: 'example@company.com',
                    defaultValue: defaultEmail.trim(),
                    note: 'メール内のリンクからパスワードを設定して登録できます',
                },
                resolve: (value) => resolve(typeof value === 'string' ? value : null),
            });
        });
    }

    answer(value: boolean | string | null): void {
        const current = this.dialog();
        if (!current) return;
        current.resolve(value);
        this.dialog.set(null);
    }
}
