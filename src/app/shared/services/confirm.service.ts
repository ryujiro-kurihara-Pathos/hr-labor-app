import { Injectable, signal } from '@angular/core';

export type ConfirmDialogOptions = {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
};

type ConfirmDialogState = ConfirmDialogOptions & {
    resolve: (value: boolean) => void;
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
                resolve,
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

    confirmInviteEmail(): Promise<boolean> {
        return this.confirm('ユーザー招待メールを送信しますか？', {
            confirmLabel: 'メールを送る',
            cancelLabel: '後でにする',
        });
    }

    answer(value: boolean): void {
        const current = this.dialog();
        if (!current) return;
        current.resolve(value);
        this.dialog.set(null);
    }
}
