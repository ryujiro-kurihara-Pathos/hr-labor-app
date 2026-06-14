import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Employee } from '../../employee/models/employee.models';
import { AppUser, UserRole } from '../../users/models/user.model';
import { Invitation } from '../models/invitation.model';
import { InvitationService } from '../services/invitation.service';
import { UserService } from '../../users/services/user.service';
import { AuthService } from '../../auth/services/auth.service';
import {
    buildInvitationEmailLinkUrl,
    invitationStatusLabel,
} from '../utils/invitation.util';
import { isValidAuthEmail, normalizeAuthEmail } from '../../auth/utils/email-link-auth.util';

@Component({
    selector: 'app-employee-invite-panel',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './employee-invite-panel.component.html',
})
export class EmployeeInvitePanelComponent {
    private readonly invitationService = inject(InvitationService);
    private readonly userService = inject(UserService);
    private readonly authService = inject(AuthService);

    employee = input.required<Employee>();
    autoOpenForm = input(false);

    readonly invitationStatusLabel = invitationStatusLabel;

    isLoading = signal(true);
    isSending = signal(false);
    isFormOpen = signal(false);
    errorMessage = signal('');
    successMessage = signal('');

    linkedUser = signal<AppUser | null>(null);
    pendingInvitation = signal<Invitation | null>(null);

    inviteRole: UserRole = 'employee';

    roleOptions: { value: UserRole; label: string }[] = [
        { value: 'employee', label: '従業員' },
        { value: 'admin', label: '管理者' },
    ];

    async ngOnInit() {
        await this.loadInviteState();
    }

    employeeEmail(): string {
        return normalizeAuthEmail(this.employee().email ?? '');
    }

    async loadInviteState() {
        const employee = this.employee();
        this.isLoading.set(true);
        this.errorMessage.set('');

        try {
            const [linkedUser, pendingInvitation] = await Promise.all([
                this.userService.getUserByEmployeeId(employee.id),
                this.invitationService.getPendingInvitationByEmployeeId(employee.id),
            ]);
            this.linkedUser.set(linkedUser);
            this.pendingInvitation.set(pendingInvitation);
        } catch (error) {
            console.error('招待情報の取得に失敗しました', error);
            this.errorMessage.set('招待情報の取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }

        if (this.autoOpenForm() && !this.linkedUser()) {
            this.openInviteForm();
        }
    }

    openInviteForm() {
        this.isFormOpen.set(true);
        this.errorMessage.set('');
        this.successMessage.set('');
        this.inviteRole = 'employee';
    }

    closeInviteForm() {
        this.isFormOpen.set(false);
        this.errorMessage.set('');
    }

    async sendInvitation() {
        const employee = this.employee();
        const email = this.employeeEmail();

        if (!email) {
            this.errorMessage.set('従業員情報にメールアドレスが登録されていません。先にメールアドレスを保存してください');
            return;
        }

        if (!isValidAuthEmail(email)) {
            this.errorMessage.set('従業員情報のメールアドレス形式が正しくありません');
            return;
        }

        if (this.linkedUser()) {
            this.errorMessage.set('この従業員にはすでにユーザーが紐づいています');
            return;
        }

        this.isSending.set(true);
        this.errorMessage.set('');
        this.successMessage.set('');

        try {
            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) {
                this.errorMessage.set('ログイン情報を確認できませんでした');
                return;
            }

            const existingUser = await this.userService.getUserByEmail(email);
            if (existingUser) {
                this.errorMessage.set('このメールアドレスはすでに登録されています');
                return;
            }

            await this.invitationService.cancelPendingInvitationsForEmployee(employee.id);

            const invitation = await this.invitationService.createInvitation({
                email,
                companyId: employee.companyId,
                employeeId: employee.id,
                role: this.inviteRole,
                invitedBy: authUser.uid,
            });

            await this.authService.sendSignInLink(
                email,
                buildInvitationEmailLinkUrl(invitation.id),
            );

            this.pendingInvitation.set(invitation);
            this.isFormOpen.set(false);
            this.successMessage.set(`${email} 宛にログイン用の招待メールを送信しました`);
        } catch (error) {
            console.error('招待メールの送信に失敗しました', error);
            this.errorMessage.set(this.convertSendError(error));
        } finally {
            this.isSending.set(false);
        }
    }

    async resendInvitation() {
        const invitation = this.pendingInvitation();
        if (!invitation) return;

        this.isSending.set(true);
        this.errorMessage.set('');
        this.successMessage.set('');

        try {
            await this.authService.sendSignInLink(
                invitation.email,
                buildInvitationEmailLinkUrl(invitation.id),
            );
            this.successMessage.set(`${invitation.email} 宛に招待メールを再送信しました`);
        } catch (error) {
            console.error('招待メールの再送信に失敗しました', error);
            this.errorMessage.set(this.convertSendError(error));
        } finally {
            this.isSending.set(false);
        }
    }

    private convertSendError(error: unknown): string {
        const code =
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            typeof (error as { code: unknown }).code === 'string'
                ? (error as { code: string }).code
                : '';

        if (code === 'auth/unauthorized-continue-uri') {
            return 'メールリンクの送信設定が未完了です。Firebase Console で認証ドメインを確認してください';
        }
        if (code === 'auth/invalid-email') {
            return 'メールアドレスの形式が正しくありません';
        }
        if (code === 'auth/operation-not-allowed') {
            return 'メールリンク認証が有効になっていません。Firebase Console の Authentication 設定を確認してください';
        }

        return '招待メールの送信に失敗しました';
    }

    roleLabel(role: UserRole): string {
        return role === 'admin' ? '管理者' : '従業員';
    }
}
