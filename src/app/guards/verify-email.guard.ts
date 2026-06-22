import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../core/firebase';
import { AuthService } from '../features/auth/services/auth.service';
import { UserService } from '../features/users/services/user.service';
import { defaultRouteForRole } from './role.guard';

/** メール未認証ユーザー向け画面。認証済みならアプリへ誘導する */
export const verifyEmailGuard: CanActivateFn = (): Promise<boolean | UrlTree> => {
    const router = inject(Router);
    const authService = inject(AuthService);
    const userService = inject(UserService);

    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            unsub();

            if (!user) {
                resolve(router.createUrlTree(['/login']));
                return;
            }

            const verified = await authService.isEmailVerified();
            if (!verified) {
                resolve(true);
                return;
            }

            const appUser = await userService.getUserByUid(user.uid);
            if (appUser?.passwordSet && appUser.status !== 'inactive') {
                resolve(router.createUrlTree([defaultRouteForRole(appUser.role)]));
                return;
            }

            resolve(router.createUrlTree(['/login']));
        });
    });
};
