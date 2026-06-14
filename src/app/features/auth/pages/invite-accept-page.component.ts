import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { updateProfile } from 'firebase/auth';

import { AuthService } from '../services/auth.service';
import { UserService } from '../../users/services/user.service';
import { InvitationService } from '../../invitations/services/invitation.service';
import { EmployeeService } from '../../employee/services/employee.service';
import { CompanyService } from '../../company/services/company.service';
import { Invitation } from '../../invitations/models/invitation.model';
import { Employee } from '../../employee/models/employee.models';
import { validateInvitationForAccept } from '../../invitations/utils/invitation.util';
import { convertEmailLinkError } from '../utils/email-link-auth.util';
import { defaultRouteForRole } from '../../../guards/role.guard';

@Component({
    selector: 'app-invite-accept-page',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './invite-accept-page.component.html',
})
export class InviteAcceptPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly invitationService = inject(InvitationService);
    private readonly employeeService = inject(EmployeeService);
    private readonly companyService = inject(CompanyService);

    isLoading = signal(true);
    isSigningIn = signal(false);
    errorMessage = signal('');
    infoMessage = signal('');

    invitation = signal<Invitation | null>(null);
    employee = signal<Employee | null>(null);
    companyName = signal('');

    async ngOnInit() {
        const invitationId = this.route.snapshot.params['invitationId'];
        if (!invitationId) {
            this.errorMessage.set('招待が見つかりませんでした');
            this.isLoading.set(false);
            return;
        }

        await this.loadInvitation(invitationId);

        if (this.errorMessage() || !this.invitation()) {
            this.isLoading.set(false);
            return;
        }

        if (this.authService.isEmailSignInLink(window.location.href)) {
            await this.completeEmailLinkSignIn();
            return;
        }

        this.infoMessage.set(
            '招待メール内のログインリンクからアクセスしてください。メールが届いていない場合は、管理者に再送を依頼してください。',
        );
        this.isLoading.set(false);
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

            const [employee, company] = await Promise.all([
                this.employeeService.getEmployeeById(invitation!.employeeId),
                this.companyService.getCompanyById(invitation!.companyId),
            ]);

            if (!employee) {
                this.errorMessage.set('招待に紐づく従業員が見つかりませんでした');
                return;
            }

            this.employee.set(employee);
            this.companyName.set(company?.name ?? '');
        } catch (error) {
            console.error('招待情報の取得に失敗しました', error);
            this.errorMessage.set('招待情報の取得に失敗しました');
        }
    }

    private async completeEmailLinkSignIn() {
        const invitation = this.invitation();
        const employee = this.employee();
        if (!invitation || !employee) return;

        this.isSigningIn.set(true);
        this.errorMessage.set('');
        this.infoMessage.set('ログインリンクを確認しています...');

        try {
            const authUser = await this.authService.signInWithEmailLink(
                invitation.email,
                window.location.href,
            );

            let appUser = await this.userService.getUserByUid(authUser.uid);

            if (!appUser) {
                const existingByEmail = await this.userService.getUserByEmail(invitation.email);
                if (existingByEmail && existingByEmail.uid !== authUser.uid) {
                    this.errorMessage.set('このメールアドレスはすでに別のアカウントで使用されています');
                    await this.authService.logout();
                    return;
                }

                await this.userService.createUser({
                    uid: authUser.uid,
                    lastName: employee.lastName,
                    firstName: employee.firstName,
                    lastNameKana: employee.lastNameKana,
                    firstNameKana: employee.firstNameKana,
                    email: invitation.email,
                    role: invitation.role,
                    status: 'active',
                    companyId: invitation.companyId,
                    employeeId: invitation.employeeId,
                });

                await updateProfile(authUser, {
                    displayName: `${employee.lastName} ${employee.firstName}`.trim(),
                });

                await this.invitationService.markInvitationAccepted(invitation.id);
                appUser = await this.userService.getUserByUid(authUser.uid);
            }

            await this.router.navigate([appUser ? defaultRouteForRole(appUser.role) : '/my-page']);
        } catch (error) {
            console.error('メールリンクでのログインに失敗しました', error);
            this.errorMessage.set(convertEmailLinkError(error));
            this.infoMessage.set('');
        } finally {
            this.isSigningIn.set(false);
            this.isLoading.set(false);
        }
    }
}
