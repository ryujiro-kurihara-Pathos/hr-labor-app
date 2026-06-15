import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { updateProfile } from 'firebase/auth';

import { AuthService } from '../services/auth.service';
import { UserService } from '../../users/services/user.service';
import { InvitationService } from '../../invitations/services/invitation.service';
import { EmployeeService } from '../../employee/services/employee.service';
import { Invitation } from '../../invitations/models/invitation.model';
import { Employee } from '../../employee/models/employee.models';
import { validateInvitationForAccept } from '../../invitations/utils/invitation.util';
import { convertEmailLinkError, normalizeAuthEmail } from '../utils/email-link-auth.util';
import { convertSetPasswordError, validatePasswordInput } from '../utils/password.util';
import { defaultRouteForRole } from '../../../guards/role.guard';

type InviteStep = 'loading' | 'awaiting-link' | 'setting-password' | 'done';

@Component({
    selector: 'app-invite-accept-page',
    standalone: true,
    imports: [RouterLink, FormsModule],
    templateUrl: './invite-accept-page.component.html',
})
export class InviteAcceptPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly invitationService = inject(InvitationService);
    private readonly employeeService = inject(EmployeeService);

    step = signal<InviteStep>('loading');
    isProcessing = signal(false);
    errorMessage = signal('');
    infoMessage = signal('');

    invitation = signal<Invitation | null>(null);
    employee = signal<Employee | null>(null);

    password = '';
    confirmPassword = '';

    async ngOnInit() {
        const invitationId = this.route.snapshot.params['invitationId'];
        if (!invitationId) {
            this.errorMessage.set('招待が見つかりませんでした');
            this.step.set('awaiting-link');
            return;
        }

        if (this.authService.isEmailSignInLink(window.location.href)) {
            await this.authenticateFromEmailLink(invitationId);
            return;
        }

        await this.loadInvitation(invitationId);

        if (this.errorMessage() || !this.invitation()) {
            this.step.set('awaiting-link');
            return;
        }

        const authUser = this.authService.getCurrentAuthUser();
        if (authUser) {
            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (appUser?.passwordSet) {
                await this.router.navigate([defaultRouteForRole(appUser.role)]);
                return;
            }
            if (appUser && !appUser.passwordSet) {
                await this.ensureEmployeeLoaded();
                this.step.set('setting-password');
                this.infoMessage.set('パスワードを設定してアカウント登録を完了してください。');
                return;
            }
        }

        this.infoMessage.set(
            '招待メール内のリンクからアクセスしてください。メールが届いていない場合は、管理者に再送を依頼してください。',
        );
        this.step.set('awaiting-link');
    }

    inviteCompanyName(): string {
        const invitation = this.invitation();
        return invitation?.companyName || '会社';
    }

    inviteEmployeeName(): string {
        const employee = this.employee();
        if (employee) {
            return `${employee.lastName} ${employee.firstName}`.trim();
        }

        const invitation = this.invitation();
        if (!invitation) return '';
        return `${invitation.employeeLastName} ${invitation.employeeFirstName}`.trim();
    }

    private resolveInviteEmail(): string {
        return (
            this.authService.getStoredEmailForSignIn()
            || normalizeAuthEmail(this.route.snapshot.queryParamMap.get('email') ?? '')
        );
    }

    private async authenticateFromEmailLink(invitationId: string) {
        const email = this.resolveInviteEmail();
        if (!email) {
            this.errorMessage.set(
                '招待リンクからメールアドレスを確認できませんでした。管理者に招待メールの再送を依頼してください。',
            );
            this.step.set('awaiting-link');
            return;
        }

        this.isProcessing.set(true);
        this.errorMessage.set('');
        this.infoMessage.set('メールアドレスを確認しています...');

        try {
            await this.authService.signInWithEmailLink(email, window.location.href);
            await this.loadInvitation(invitationId);

            if (this.errorMessage() || !this.invitation()) {
                await this.authService.logout();
                this.step.set('awaiting-link');
                return;
            }

            if (this.invitation()!.email !== email) {
                this.errorMessage.set('招待メールのアドレスと一致しません');
                await this.authService.logout();
                this.step.set('awaiting-link');
                return;
            }

            await this.completeRegistrationAfterAuth();
        } catch (error) {
            console.error('メールリンクの確認に失敗しました', error);
            this.errorMessage.set(convertEmailLinkError(error));
            this.infoMessage.set('');
            this.step.set('awaiting-link');
        } finally {
            this.isProcessing.set(false);
        }
    }

    private async loadInvitation(invitationId: string) {
        this.errorMessage.set('');

        try {
            const invitation = await this.invitationService.getInvitationById(invitationId);
            const validationError = validateInvitationForAccept(invitation);
            if (validationError) {
                this.errorMessage.set(validationError);
                return;
            }

            this.invitation.set(invitation);
        } catch (error) {
            console.error('招待情報の取得に失敗しました', error);
            this.errorMessage.set(this.toInvitationLoadError(error));
        }
    }

    private async ensureEmployeeLoaded(): Promise<Employee | null> {
        const cached = this.employee();
        if (cached) return cached;

        const invitation = this.invitation();
        if (!invitation) return null;

        const employee = await this.employeeService.getEmployeeById(invitation.employeeId);
        if (employee) {
            this.employee.set(employee);
        }
        return employee;
    }

    private async completeRegistrationAfterAuth() {
        const invitation = this.invitation();
        if (!invitation) return;

        const authUser = this.authService.getCurrentAuthUser();
        if (!authUser) return;

        const employee = await this.ensureEmployeeLoaded();
        if (!employee) {
            this.errorMessage.set('招待に紐づく従業員が見つかりませんでした');
            await this.authService.logout();
            this.step.set('awaiting-link');
            return;
        }

        let appUser = await this.userService.getUserByUid(authUser.uid);

        if (appUser?.passwordSet) {
            await this.router.navigate([defaultRouteForRole(appUser.role)]);
            return;
        }

        if (!appUser) {
            const existingByEmail = await this.userService.getUserByEmail(invitation.email);
            if (existingByEmail && existingByEmail.uid !== authUser.uid) {
                this.errorMessage.set('このメールアドレスはすでに別のアカウントで使用されています');
                await this.authService.logout();
                this.step.set('awaiting-link');
                return;
            }

            await this.userService.createUser({
                uid: authUser.uid,
                lastName: employee.lastName,
                firstName: employee.firstName,
                lastNameKana: employee.lastNameKana,
                firstNameKana: employee.firstNameKana,
                email: invitation.email,
                password: '',
                passwordSet: false,
                role: invitation.role,
                status: 'active',
                companyId: invitation.companyId,
                employeeId: invitation.employeeId,
            });

            await updateProfile(authUser, {
                displayName: `${employee.lastName} ${employee.firstName}`.trim(),
            });

            appUser = await this.userService.getUserByUid(authUser.uid);
        }

        this.step.set('setting-password');
        this.infoMessage.set('メールアドレスの確認が完了しました。パスワードを設定してください。');
    }

    async onSetPassword() {
        const invitation = this.invitation();
        const authUser = this.authService.getCurrentAuthUser();
        if (!invitation || !authUser) {
            this.errorMessage.set('セッションが切れました。招待メールのリンクから再度アクセスしてください。');
            return;
        }

        const validationError = validatePasswordInput(this.password, this.confirmPassword);
        if (validationError) {
            this.errorMessage.set(validationError);
            return;
        }

        this.isProcessing.set(true);
        this.errorMessage.set('');

        try {
            const trimmedPassword = this.password.trim();
            await this.authService.setPassword(trimmedPassword);
            await this.userService.setUserPassword(authUser.uid, trimmedPassword);

            if (invitation.status === 'pending') {
                await this.invitationService.markInvitationAccepted(invitation.id);
            }

            const appUser = await this.userService.getUserByUid(authUser.uid);
            await this.router.navigate([appUser ? defaultRouteForRole(appUser.role) : '/my-page']);
        } catch (error) {
            console.error('パスワードの設定に失敗しました', error);
            this.errorMessage.set(convertSetPasswordError(error));
        } finally {
            this.isProcessing.set(false);
        }
    }

    private toInvitationLoadError(error: unknown): string {
        const code =
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            typeof (error as { code: unknown }).code === 'string'
                ? (error as { code: string }).code
                : '';

        if (code === 'permission-denied') {
            return '招待情報へのアクセスが拒否されました。Firestore のセキュリティルールを確認してください。';
        }

        return '招待情報の取得に失敗しました';
    }
}
