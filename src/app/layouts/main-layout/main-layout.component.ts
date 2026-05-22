import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';

import { Unsubscribe } from 'firebase/auth';
import { AuthService } from '../../features/auth/services/auth.service';
import { UserService } from '../../features/users/services/user.service';
import { AppUser } from '../../features/auth/models/auth.model';
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

    ngOnInit() {
        this.unsubscribeAuth = this.authService.watchAuthState(async (firebaseUser) => {
            if(!firebaseUser) {
                this.currentUser.set(null);
                await this.router.navigate(['/login']);
                return;
            }

            const appUser = await this.userService.getUserByUid(firebaseUser.uid);

            if(!appUser) {
                this.currentUser.set(null);
                await this.router.navigate(['/login']);
                return;
            }

            this.currentUser.set(appUser);
        });
    }

    ngOnDestroy() {
        this.unsubscribeAuth?.();
    }
}