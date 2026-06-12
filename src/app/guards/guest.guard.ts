import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../core/firebase';
import { UserService } from '../features/users/services/user.service';
import { defaultRouteForRole } from './role.guard';

export const guestGuard: CanActivateFn = () => {
    const router = inject(Router);
    const userService = inject(UserService);

    return new Promise<boolean>((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            unsub();

            if (user) {
                const appUser = await userService.getUserByUid(user.uid);
                await router.navigate([appUser ? defaultRouteForRole(appUser.role) : '/home']);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};
