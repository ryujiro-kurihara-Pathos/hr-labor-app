import { Component,inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../services/auth.service';

@Component({
    selector: 'app-login-page',
    standalone: true,
    imports: [FormsModule, RouterLink],
    templateUrl: './login-page.component.html',
})

export class LoginPageComponent {
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);

    // 新規登録ページに遷移
    goToSignupPage() {
        this.router.navigate(['/signup']);
    }

    // ログインに必要な情報
    email = '';
    password = '';

    errorMessage = '';
    isLoading = false;

    // ログイン
    async onLogin() {
        this.errorMessage = '';

        if(this.isFormEmpty(this.email) || this.isFormEmpty(this.password)) {
            this.errorMessage = 'メールアドレスとパスワードを入力してください';
            return;
        }

        try {
            this.isLoading = true;

            // Authenticationでログイン
            await this.authService.login(this.email.trim(), this.password.trim());

            // homeページに遷移
            await this.router.navigate(['/home']);
        } catch (error) {
            console.error('ログインに失敗しました。', error);
            this.errorMessage = this.convertLoginError(error);
        } finally {
            this.isLoading = false;
        }
    }

    // ログインエラーを変換
    convertLoginError(error: unknown): string {
        const code =
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            typeof (error as { code: unknown }).code === 'string'
                ? (error as { code: string }).code
                : '';

        if (code === 'auth/invalid-email') {
            return 'メールアドレスの形式が正しくありません。';
        }

        if (
            code === 'auth/user-not-found' ||
            code === 'auth/wrong-password' ||
            code === 'auth/invalid-credential'
        ) {
            return 'メールアドレスまたはパスワードが違います。';
        }

        if (code === 'auth/too-many-requests') {
            return 'ログイン試行回数が多すぎます。時間をおいて再度お試しください。';
        }

        return 'ログインに失敗しました。';
    }

    // フォームが空白かどうか
    isFormEmpty(value: string): boolean {
        return value.trim() === '';
    }
}