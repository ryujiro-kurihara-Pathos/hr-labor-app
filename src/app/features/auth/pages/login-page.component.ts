import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { UserService } from '../../users/services/user.service';
import { defaultRouteForRole } from '../../../guards/role.guard';

@Component({
    selector: 'app-login-page',
    standalone: true,
    imports: [FormsModule, RouterLink],
    templateUrl: './login-page.component.html',
})

export class LoginPageComponent {
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);

    email = '';
    password = '';

    errorMessage = '';
    isLoading = false;

    async onLogin() {
        this.errorMessage = '';

        if (this.isFormEmpty(this.email) || this.isFormEmpty(this.password)) {
            this.errorMessage = 'メールアドレスとパスワードを入力してください';
            return;
        }

        try {
            this.isLoading = true;
            await this.authService.login(this.email.trim(), this.password.trim());

            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) {
                this.errorMessage = 'ログインに失敗しました。';
                return;
            }

            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (!appUser) {
                this.errorMessage = 'アカウントが見つかりません。管理者から招待メールを受け取ってください。';
                await this.authService.logout();
                return;
            }

            if (!appUser.passwordSet) {
                this.errorMessage = 'パスワードが未設定です。招待メールのリンクからパスワードを設定してください。';
                await this.authService.logout();
                return;
            }

            if (appUser.status === 'inactive') {
                this.errorMessage = 'このアカウントは停止されています。管理者にお問い合わせください。';
                await this.authService.logout();
                return;
            }

            await this.router.navigate([defaultRouteForRole(appUser.role)]);
        } catch (error) {
            console.error('ログインに失敗しました。', error);
            this.errorMessage = this.convertLoginError(error);
        } finally {
            this.isLoading = false;
        }
    }

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

    isFormEmpty(value: string): boolean {
        return value.trim() === '';
    }
}
