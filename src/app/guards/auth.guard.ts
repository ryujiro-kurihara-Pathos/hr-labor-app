import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../core/firebase';
import { UserService } from '../features/users/services/user.service';

export const authGuard: CanActivateFn = (): Promise<boolean | UrlTree> => {
    const router = inject(Router);
    const userService = inject(UserService);

    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            unsub();

            if (!user) {
                resolve(router.createUrlTree(['/login']));
                return;
            }

            const appUser = await userService.getUserByUid(user.uid);
            if (!appUser || !appUser.passwordSet || appUser.status === 'inactive') {
                resolve(router.createUrlTree(['/login']));
                return;
            }

            resolve(true);
        });
    });
};
