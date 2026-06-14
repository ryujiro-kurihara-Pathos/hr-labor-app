import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { UserService } from '../../users/services/user.service';
import { defaultRouteForRole } from '../../../guards/role.guard';
import {
    convertEmailLinkError,
    isValidAuthEmail,
    normalizeAuthEmail,
} from '../utils/email-link-auth.util';

@Component({
    selector: 'app-login-page',
    standalone: true,
    imports: [FormsModule, RouterLink],
    templateUrl: './login-page.component.html',
})

export class LoginPageComponent {
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);

    email = '';
    password = '';
    linkEmail = '';

    errorMessage = '';
    linkErrorMessage = '';
    successMessage = '';
    linkSuccessMessage = '';

    isLoading = false;
    isSendingLink = false;
    isCompletingLink = signal(false);

    async ngOnInit() {
        if (this.authService.isEmailSignInLink(window.location.href)) {
            await this.completeEmailLinkSignIn();
            return;
        }
    }

    goToSignupPage() {
        this.router.navigate(['/signup']);
    }

    async onLogin() {
        this.errorMessage = '';

        if (this.isFormEmpty(this.email) || this.isFormEmpty(this.password)) {
            this.errorMessage = 'メールアドレスとパスワードを入力してください';
            return;
        }

        try {
            this.isLoading = true;
            await this.authService.login(this.email.trim(), this.password.trim());

            const appUser = await this.userService.getUserByUid(this.authService.getCurrentAuthUser()!.uid);
            await this.router.navigate([appUser ? defaultRouteForRole(appUser.role) : '/home']);
        } catch (error) {
            console.error('ログインに失敗しました。', error);
            this.errorMessage = this.convertLoginError(error);
        } finally {
            this.isLoading = false;
        }
    }

    async onSendLoginLink() {
        this.linkErrorMessage = '';
        this.linkSuccessMessage = '';

        const email = normalizeAuthEmail(this.linkEmail || this.email);
        if (!email) {
            this.linkErrorMessage = 'メールアドレスを入力してください';
            return;
        }
        if (!isValidAuthEmail(email)) {
            this.linkErrorMessage = 'メールアドレスの形式が正しくありません';
            return;
        }

        this.isSendingLink = true;
        try {
            const continueUrl = `${window.location.origin}/login`;
            await this.authService.sendSignInLink(email, continueUrl);
            this.linkSuccessMessage = `${email} 宛にログインリンクを送信しました。メール内のリンクからログインしてください。`;
        } catch (error) {
            console.error('ログインリンクの送信に失敗しました', error);
            this.linkErrorMessage = convertEmailLinkError(error);
        } finally {
            this.isSendingLink = false;
        }
    }

    private async completeEmailLinkSignIn() {
        this.isCompletingLink.set(true);
        this.linkErrorMessage = '';

        try {
            let email =
                this.authService.getStoredEmailForSignIn()
                || normalizeAuthEmail(this.route.snapshot.queryParamMap.get('email') ?? '');

            if (!email) {
                this.linkErrorMessage =
                    'ログインを完了するには、メールアドレスを入力して「ログインリンクを送信」を再度実行してください';
                return;
            }

            const authUser = await this.authService.signInWithEmailLink(email, window.location.href);
            const appUser = await this.userService.getUserByUid(authUser.uid);

            if (!appUser) {
                this.linkErrorMessage = 'アカウントが見つかりません。管理者から招待メールを受け取ってください';
                await this.authService.logout();
                return;
            }

            await this.router.navigate([defaultRouteForRole(appUser.role)]);
        } catch (error) {
            console.error('メールリンクでのログインに失敗しました', error);
            this.linkErrorMessage = convertEmailLinkError(error);
        } finally {
            this.isCompletingLink.set(false);
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
