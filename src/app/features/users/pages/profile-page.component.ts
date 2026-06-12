import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../auth/services/auth.service';
import { CompanyService } from '../../company/services/company.service';
import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';
import { AppUser, UserRole, UserStatus } from '../models/user.model';
import { UserService } from '../services/user.service';
import { ConfirmService } from '../../../shared/services/confirm.service';

@Component({
    selector: 'app-profile-page',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './profile-page.component.html',
})
export class ProfilePageComponent {
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly companyService = inject(CompanyService);
    private readonly employeeService = inject(EmployeeService);
    private readonly router = inject(Router);
    private readonly confirmService = inject(ConfirmService);

    isLoading = signal(true);
    isLoggingOut = signal(false);
    errorMessage = signal('');

    currentUser = signal<AppUser | null>(null);
    companyName = signal('');
    linkedEmployee = signal<Employee | null>(null);

    displayName = computed(() => {
        const user = this.currentUser();
        if (!user) return '—';
        const name = `${user.lastName} ${user.firstName}`.trim();
        return name || '—';
    });

    userInitial = computed(() => this.displayName().charAt(0) || '？');

    async ngOnInit(): Promise<void> {
        await this.loadProfile();
    }

    roleLabel(role: UserRole | undefined): string {
        const labels: Record<UserRole, string> = {
            admin: '管理者',
            employee: '従業員',
        };
        return role ? labels[role] : '—';
    }

    statusLabel(status: UserStatus | undefined): string {
        const labels: Record<UserStatus, string> = {
            active: '有効',
            inactive: '無効',
        };
        return status ? labels[status] : '—';
    }

    formatDateTime(value: AppUser['createdAt'] | undefined): string {
        if (!value) return '—';
        const date = typeof value.toDate === 'function' ? value.toDate() : null;
        if (!date) return '—';
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    async onLogout(): Promise<void> {
        if (this.isLoggingOut()) return;

        const confirmed = await this.confirmService.confirmLogout();
        if (!confirmed) return;

        this.isLoggingOut.set(true);
        try {
            await this.authService.logout();
            await this.router.navigate(['/login']);
        } catch (error) {
            console.error('ログアウトに失敗しました', error);
            this.errorMessage.set('ログアウトに失敗しました');
        } finally {
            this.isLoggingOut.set(false);
        }
    }

    private async loadProfile(): Promise<void> {
        this.isLoading.set(true);
        this.errorMessage.set('');

        try {
            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) {
                this.errorMessage.set('ログイン情報を取得できませんでした');
                return;
            }

            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (!appUser) {
                this.errorMessage.set('ユーザー情報が見つかりませんでした');
                return;
            }
            this.currentUser.set(appUser);

            const [company, employee] = await Promise.all([
                this.companyService.getCompanyById(appUser.companyId),
                appUser.employeeId
                    ? this.employeeService.getEmployeeById(appUser.employeeId)
                    : Promise.resolve(null),
            ]);

            this.companyName.set(company?.name ?? '—');
            this.linkedEmployee.set(employee);
        } catch (error) {
            console.error('プロフィールの取得に失敗しました', error);
            this.errorMessage.set('プロフィールの取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }
}
