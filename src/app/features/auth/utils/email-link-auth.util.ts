export const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';

export function normalizeAuthEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function isValidAuthEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeAuthEmail(email));
}

export function convertEmailLinkError(error: unknown): string {
    const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code: unknown }).code === 'string'
            ? (error as { code: string }).code
            : '';

    if (code === 'auth/invalid-email') {
        return 'メールアドレスの形式が正しくありません';
    }
    if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
        return 'ログインリンクの有効期限が切れているか、無効です。招待メールの再送を依頼してください';
    }
    if (code === 'auth/invalid-credential') {
        return 'ログインリンクが無効です。もう一度メールからリンクを開いてください';
    }
    if (code === 'auth/too-many-requests') {
        return 'リクエストが多すぎます。時間をおいて再度お試しください';
    }

    return 'メールリンクでのログインに失敗しました';
}
