import { Component, inject, Input } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';

import { AuthService } from '../../features/auth/services/auth.service';
import { AppUser, UserRole } from '../../features/users/models/user.model';
import { ConfirmService } from '../services/confirm.service';

type NavItem = {
    label: string;
    route: string;
    icon: string;
    exact?: boolean;
};

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive],
    templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly confirmService = inject(ConfirmService);

    @Input() currentUser: AppUser | null = null;

    readonly adminNavItems: NavItem[] = [
        { label: 'ホーム', route: '/home', icon: 'ホ', exact: true },
        { label: '会社・事業所', route: '/company', icon: '社' },
        { label: '従業員管理', route: '/employees', icon: '員' },
        { label: '社会保険加入状況', route: '/social-insurance-status', icon: '保' },
        { label: '保険料計算', route: '/premium', icon: '算' },
        { label: '手続き', route: '/procedures', icon: '届' },
    ];

    readonly employeeNavItems: NavItem[] = [
        { label: 'マイページ', route: '/my-page', icon: '私', exact: true },
        { label: '保険料', route: '/my-insurance-premium', icon: '算' },
    ];

    navItems(): NavItem[] {
        return this.currentUser?.role === 'employee'
            ? this.employeeNavItems
            : this.adminNavItems;
    }

    userDisplayName(): string {
        if (!this.currentUser) return 'ゲスト';
        const name = `${this.currentUser.lastName} ${this.currentUser.firstName}`.trim();
        return name || 'ユーザー';
    }

    userInitial(): string {
        const name = this.userDisplayName();
        return name.charAt(0);
    }

    profileRoute(): string {
        return this.currentUser?.role === 'employee' ? '/my-page' : '/profile';
    }

    homeRoute(): string {
        return this.currentUser?.role === 'employee' ? '/my-page' : '/home';
    }

    roleLabel(role: UserRole | undefined): string {
        const labels: Record<UserRole, string> = {
            admin: '管理者',
            employee: '従業員',
        };
        return role ? labels[role] : '—';
    }

    async onLogout(): Promise<void> {
        const confirmed = await this.confirmService.confirmLogout();
        if (!confirmed) return;

        try {
            await this.authService.logout();
            await this.router.navigate(['/login']);
        } catch (error) {
            console.error('ログアウトに失敗しました。', error);
        }
    }
}
