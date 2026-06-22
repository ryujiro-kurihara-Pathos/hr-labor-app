import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';

import { Unsubscribe } from 'firebase/auth';
import { AuthService } from '../../features/auth/services/auth.service';
import { UserService } from '../../features/users/services/user.service';
import { AppUser } from '../../features/users/models/user.model';
import { SidebarComponent } from '../../shared/components/sidebar.component';

@Component({
    selector: 'app-main-layout',
    standalone: true,
    imports: [RouterOutlet, SidebarComponent],
    templateUrl: './main-layout.component.html',
})

export class MainLayoutComponent {
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly router = inject(Router);

    private unsubscribeAuth?: Unsubscribe;

    // 現在のユーザー
    currentUser = signal<AppUser | null>(null);

    // 初期処理
    async ngOnInit() {
        // ログイン状態の監視
        this.unsubscribeAuth = this.authService.watchAuthState(async (authUser) => {
            // Authユーザーが存在しない場合は、ログイン画面にリダイレクト
            if(!authUser) {
                this.currentUser.set(null);
                await this.router.navigate(['/login']);
                return;
            }

            // Appユーザーの取得
            const appUser = await this.userService.getUserByUid(authUser.uid);
            // Appユーザーが存在しない場合は、ログイン画面にリダイレクト
            if(!appUser) {
                this.currentUser.set(null);
                await this.router.navigate(['/login']);
                return;
            }

            // inactiveなユーザーの場合は、ログイン画面にリダイレクト
            if(appUser.status === 'inactive') {
                await this.authService.logout();
                await this.router.navigate(['/login']);
                return;
            }

            const verified = await this.authService.isEmailVerified();
            if (!verified) {
                this.currentUser.set(null);
                await this.router.navigate(['/verify-email']);
                return;
            }

            this.currentUser.set(appUser);
        });
    }

    ngOnDestroy() {
        this.unsubscribeAuth?.();
    }
}