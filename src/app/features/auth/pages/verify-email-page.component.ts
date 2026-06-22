import { Component, inject, signal } from '@angular/core';

import { AuthService } from '../services/auth.service';
import { UserService } from '../../users/services/user.service';
import { defaultRouteForRole } from '../../../guards/role.guard';
import { Router } from '@angular/router';

@Component({
    selector: 'app-verify-email-page',
    standalone: true,
    templateUrl: './verify-email-page.component.html',
})
export class VerifyEmailPageComponent {
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly router = inject(Router);

    email = signal('');
    message = signal('');
    errorMessage = signal('');
    isProcessing = signal(false);

    constructor() {
        const user = this.authService.getCurrentAuthUser();
        this.email.set(user?.email ?? '');
    }

    async resendVerificationEmail() {
        this.message.set('');
        this.errorMessage.set('');

        try {
            this.isProcessing.set(true);
            await this.authService.sendVerificationEmail();
            this.message.set('確認メールを再送しました。メールボックスをご確認ください。');
        } catch (error) {
            console.error('確認メールの再送に失敗しました', error);
            this.errorMessage.set(this.convertError(error));
        } finally {
            this.isProcessing.set(false);
        }
    }

    async checkVerificationStatus() {
        this.message.set('');
        this.errorMessage.set('');

        try {
            this.isProcessing.set(true);
            const verified = await this.authService.isEmailVerified();
            if (!verified) {
                this.errorMessage.set(
                    'まだメール認証が完了していません。メール内のリンクを開いてから再度お試しください。',
                );
                return;
            }

            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) {
                await this.router.navigate(['/login']);
                return;
            }

            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (appUser?.passwordSet && appUser.status !== 'inactive') {
                await this.router.navigate([defaultRouteForRole(appUser.role)]);
                return;
            }

            await this.router.navigate(['/login']);
        } catch (error) {
            console.error('メール認証状態の確認に失敗しました', error);
            this.errorMessage.set('認証状態の確認に失敗しました。');
        } finally {
            this.isProcessing.set(false);
        }
    }

    async logout() {
        await this.authService.logout();
        await this.router.navigate(['/login']);
    }

    private convertError(error: unknown): string {
        const code =
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            typeof (error as { code: unknown }).code === 'string'
                ? (error as { code: string }).code
                : '';

        if (code === 'auth/too-many-requests') {
            return '送信回数が多すぎます。時間をおいて再度お試しください。';
        }

        return '確認メールの送信に失敗しました。';
    }
}
