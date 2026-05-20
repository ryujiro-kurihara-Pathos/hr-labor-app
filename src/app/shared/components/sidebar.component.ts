import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';

import { AuthService } from '../../features/auth/services/auth.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive],
    templateUrl: './sidebar.component.html',
})

export class SidebarComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    async onLogout(): Promise<void> {
        try {
            await this.authService.logout();
            await this.router.navigate(['/login']);
        } catch (error) {
            console.error('ログアウトに失敗しました。', error);
        }
    }
}