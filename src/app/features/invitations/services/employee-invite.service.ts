import { inject, Injectable } from '@angular/core';

import { Employee } from '../../employee/models/employee.models';
import { AuthService } from '../../auth/services/auth.service';
import { CompanyService } from '../../company/services/company.service';
import { isValidAuthEmail, normalizeAuthEmail } from '../../auth/utils/email-link-auth.util';
import { UserRole } from '../../users/models/user.model';
import { UserService } from '../../users/services/user.service';
import { Timestamp } from 'firebase/firestore';

import { Invitation } from '../models/invitation.model';
import { InvitationService } from './invitation.service';
import { buildInvitationEmailLinkUrl } from '../utils/invitation.util';

@Injectable({
    providedIn: 'root',
})
export class EmployeeInviteService {
    private readonly invitationService = inject(InvitationService);
    private readonly userService = inject(UserService);
    private readonly authService = inject(AuthService);
    private readonly companyService = inject(CompanyService);

    async sendInvitation(
        employee: Employee,
        email: string,
        role: UserRole = 'employee',
    ): Promise<Invitation> {
        const normalizedEmail = normalizeAuthEmail(email);
        if (!isValidAuthEmail(normalizedEmail)) {
            throw new Error('INVALID_EMAIL');
        }

        const linkedUser = await this.userService.getUserByEmployeeId(employee.id);
        if (linkedUser) {
            throw new Error('ALREADY_LINKED');
        }

        const existingUser = await this.userService.getUserByEmail(normalizedEmail);
        if (existingUser) {
            throw new Error('EMAIL_TAKEN');
        }

        const authUser = this.authService.getCurrentAuthUser();
        if (!authUser) {
            throw new Error('NOT_AUTHENTICATED');
        }

        await this.invitationService.cancelPendingInvitationsForEmployee(employee.id);

        const company = await this.companyService.getCompanyById(employee.companyId);

        const invitation = await this.invitationService.createInvitation({
            email: normalizedEmail,
            companyId: employee.companyId,
            employeeId: employee.id,
            employeeLastName: employee.lastName,
            employeeFirstName: employee.firstName,
            companyName: company?.name ?? '',
            role,
            invitedBy: authUser.uid,
        });

        await this.authService.sendSignInLink(
            normalizedEmail,
            buildInvitationEmailLinkUrl(invitation.id, normalizedEmail),
        );

        return invitation;
    }

    async resendInvitation(
        employee: Employee,
        email: string,
        invitation: Invitation,
    ): Promise<Invitation> {
        const normalizedEmail = normalizeAuthEmail(email);
        if (!normalizedEmail) {
            throw new Error('INVALID_EMAIL');
        }
        if (!isValidAuthEmail(normalizedEmail)) {
            throw new Error('INVALID_EMAIL');
        }

        if (normalizedEmail !== invitation.email) {
            const existingUser = await this.userService.getUserByEmail(normalizedEmail);
            if (existingUser) {
                throw new Error('EMAIL_TAKEN');
            }
        }

        await this.invitationService.updatePendingInvitationForResend(
            invitation.id,
            normalizedEmail,
        );

        await this.authService.sendSignInLink(
            normalizedEmail,
            buildInvitationEmailLinkUrl(invitation.id, normalizedEmail),
        );

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        return {
            ...invitation,
            email: normalizedEmail,
            employeeLastName: employee.lastName,
            employeeFirstName: employee.firstName,
            expiresAt: Timestamp.fromDate(expiresAt) as Invitation['expiresAt'],
        };
    }

    toUserMessage(error: unknown): string {
        if (error instanceof Error) {
            switch (error.message) {
                case 'INVALID_EMAIL':
                    return 'メールアドレスの形式が正しくありません';
                case 'ALREADY_LINKED':
                    return 'この従業員にはすでにユーザーが紐づいています';
                case 'EMAIL_TAKEN':
                    return 'このメールアドレスはすでに登録されています';
                case 'NOT_AUTHENTICATED':
                    return 'ログイン情報を確認できませんでした';
            }
        }

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
}
