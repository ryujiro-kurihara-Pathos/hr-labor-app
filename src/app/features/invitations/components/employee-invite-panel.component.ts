import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Employee } from '../../employee/models/employee.models';
import { AppUser, UserRole } from '../../users/models/user.model';
import { Invitation } from '../models/invitation.model';
import { InvitationService } from '../services/invitation.service';
import { EmployeeInviteService } from '../services/employee-invite.service';
import { UserService } from '../../users/services/user.service';
import { invitationStatusLabel } from '../utils/invitation.util';
import { isValidAuthEmail, normalizeAuthEmail } from '../../auth/utils/email-link-auth.util';

@Component({
    selector: 'app-employee-invite-panel',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './employee-invite-panel.component.html',
})
export class EmployeeInvitePanelComponent {
    private readonly invitationService = inject(InvitationService);
    private readonly employeeInviteService = inject(EmployeeInviteService);
    private readonly userService = inject(UserService);

    employee = input.required<Employee>();
    initialSuccessMessage = input('');

    readonly invitationStatusLabel = invitationStatusLabel;

    isLoading = signal(true);
    isSending = signal(false);
    errorMessage = signal('');
    successMessage = signal('');

    linkedUser = signal<AppUser | null>(null);
    pendingInvitation = signal<Invitation | null>(null);

    inviteEmail = '';
    inviteRole: UserRole = 'employee';

    roleOptions: { value: UserRole; label: string }[] = [
        { value: 'employee', label: '従業員' },
        { value: 'admin', label: '管理者' },
    ];

    constructor() {
        effect(() => {
            const employee = this.employee();
            const email = normalizeAuthEmail(employee.email ?? '');
            if (email) {
                this.inviteEmail = email;
            }
        });
    }

    async ngOnInit() {
        const initial = this.initialSuccessMessage().trim();
        if (initial) {
            this.successMessage.set(initial);
        }
        await this.loadInviteState();
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
            this.inviteEmail = normalizeAuthEmail(
                employee.email || pendingInvitation?.email || '',
            );
        } catch (error) {
            console.error('招待情報の取得に失敗しました', error);
            this.errorMessage.set('招待情報の取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    async sendInvitation() {
        const employee = this.employee();
        const email = normalizeAuthEmail(this.inviteEmail);

        if (!email) {
            this.errorMessage.set('メールアドレスを入力してください');
            return;
        }
        if (!isValidAuthEmail(email)) {
            this.errorMessage.set('メールアドレスの形式が正しくありません');
            return;
        }

        this.isSending.set(true);
        this.errorMessage.set('');
        this.successMessage.set('');

        try {
            const invitation = await this.employeeInviteService.sendInvitation(
                employee,
                email,
                this.inviteRole,
            );
            this.pendingInvitation.set(invitation);
            this.successMessage.set(`${email} 宛に招待メールを送信しました`);
        } catch (error) {
            console.error('招待メールの送信に失敗しました', error);
            this.errorMessage.set(this.employeeInviteService.toUserMessage(error));
        } finally {
            this.isSending.set(false);
        }
    }

    async resendInvitation() {
        const invitation = this.pendingInvitation();
        const employee = this.employee();
        if (!invitation) return;

        const email = normalizeAuthEmail(employee.email ?? '');
        if (!email) {
            this.errorMessage.set('従業員情報にメールアドレスが登録されていません。基本情報を保存してから再送信してください。');
            return;
        }
        if (!isValidAuthEmail(email)) {
            this.errorMessage.set('メールアドレスの形式が正しくありません。基本情報を修正して保存してください。');
            return;
        }

        this.isSending.set(true);
        this.errorMessage.set('');
        this.successMessage.set('');

        try {
            const updatedInvitation = await this.employeeInviteService.resendInvitation(
                employee,
                email,
                invitation,
            );
            this.pendingInvitation.set(updatedInvitation);
            this.successMessage.set(`${email} 宛に招待メールを再送信しました`);
        } catch (error) {
            console.error('招待メールの再送信に失敗しました', error);
            this.errorMessage.set(this.employeeInviteService.toUserMessage(error));
        } finally {
            this.isSending.set(false);
        }
    }

    roleLabel(role: UserRole): string {
        return role === 'admin' ? '管理者' : '従業員';
    }
}
