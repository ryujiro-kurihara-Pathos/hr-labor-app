import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../core/firebase';
import { AuthService } from '../features/auth/services/auth.service';
import { UserService } from '../features/users/services/user.service';
import { defaultRouteForRole } from './role.guard';

export const guestGuard: CanActivateFn = () => {
    const router = inject(Router);
    const userService = inject(UserService);
    const authService = inject(AuthService);

    return new Promise<boolean>((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            unsub();

            if (!user) {
                resolve(true);
                return;
            }

            const appUser = await userService.getUserByUid(user.uid);

            if (appUser && !appUser.passwordSet && router.url.startsWith('/invite/')) {
                resolve(true);
                return;
            }

            if (appUser?.passwordSet) {
                const verified = await authService.isEmailVerified();
                if (!verified) {
                    await router.navigate(['/verify-email']);
                    resolve(false);
                    return;
                }

                await router.navigate([defaultRouteForRole(appUser.role)]);
                resolve(false);
                return;
            }

            resolve(true);
        });
    });
};
