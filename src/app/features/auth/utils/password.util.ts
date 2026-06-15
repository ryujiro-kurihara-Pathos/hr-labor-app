const MIN_PASSWORD_LENGTH = 6;

export function validatePasswordInput(
    password: string,
    confirmPassword: string,
): string | null {
    const trimmed = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmed || !trimmedConfirm) {
        return 'パスワードを入力してください';
    }

    if (trimmed.length < MIN_PASSWORD_LENGTH) {
        return `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`;
    }

    if (trimmed !== trimmedConfirm) {
        return 'パスワードが一致しません';
    }

    return null;
}

export function convertSetPasswordError(error: unknown): string {
    const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code: unknown }).code === 'string'
            ? (error as { code: string }).code
            : '';

    if (code === 'auth/weak-password') {
        return 'パスワードが弱すぎます。別のパスワードを設定してください';
    }

    if (code === 'auth/requires-recent-login') {
        return 'セキュリティのため、招待メールのリンクから再度アクセスしてください';
    }

    return 'パスワードの設定に失敗しました';
}
