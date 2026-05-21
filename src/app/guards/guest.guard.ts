import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../core/firebase';

export const guestGuard: CanActivateFn = () => {
    const router = inject(Router);

    return new Promise<boolean>((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
            unsub();

            if(user) {
                router.navigate(['/home']);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};