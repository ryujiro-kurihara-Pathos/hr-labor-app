import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../core/firebase';
import { UserService } from '../features/users/services/user.service';
import { UserRole } from '../features/users/models/user.model';

export function defaultRouteForRole(role: UserRole): string {
    return role === 'employee' ? '/my-page' : '/home';
}

export function roleGuard(...allowedRoles: UserRole[]): CanActivateFn {
    return (): Promise<boolean | UrlTree> => {
        const router = inject(Router);
        const userService = inject(UserService);

        return new Promise((resolve) => {
            const unsub = onAuthStateChanged(auth, async (authUser) => {
                unsub();

                if (!authUser) {
                    resolve(router.createUrlTree(['/login']));
                    return;
                }

                const appUser = await userService.getUserByUid(authUser.uid);
                if (!appUser || !appUser.passwordSet || appUser.status === 'inactive') {
                    resolve(router.createUrlTree(['/login']));
                    return;
                }

                if (allowedRoles.includes(appUser.role)) {
                    resolve(true);
                    return;
                }

                resolve(router.createUrlTree([defaultRouteForRole(appUser.role)]));
            });
        });
    };
}

export const adminGuard = roleGuard('admin');
export const employeeGuard = roleGuard('employee');
