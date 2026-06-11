import { Component, inject, Input } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';

import { AuthService } from '../../features/auth/services/auth.service';
import { AppUser, UserRole } from '../../features/users/models/user.model';

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

    @Input() currentUser: AppUser | null = null;

    readonly navItems: NavItem[] = [
        { label: 'ホーム', route: '/home', icon: 'ホ', exact: true },
        { label: '会社・事業所', route: '/company', icon: '社' },
        { label: '従業員管理', route: '/employees', icon: '員' },
        { label: '社会保険加入状況', route: '/social-insurance-status', icon: '保' },
        { label: '保険料計算', route: '/premium', icon: '算' },
        { label: '手続き', route: '/procedures', icon: '届' },
    ];

    userDisplayName(): string {
        if (!this.currentUser) return 'ゲスト';
        const name = `${this.currentUser.lastName} ${this.currentUser.firstName}`.trim();
        return name || 'ユーザー';
    }

    userInitial(): string {
        const name = this.userDisplayName();
        return name.charAt(0);
    }

    roleLabel(role: UserRole | undefined): string {
        const labels: Record<UserRole, string> = {
            admin: '管理者',
            labor: '労務担当',
            employee: '従業員',
        };
        return role ? labels[role] : '—';
    }

    async onLogout(): Promise<void> {
        try {
            await this.authService.logout();
            await this.router.navigate(['/login']);
        } catch (error) {
            console.error('ログアウトに失敗しました。', error);
        }
    }
}
