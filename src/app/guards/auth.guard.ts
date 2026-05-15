import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

export const authGuard: CanActivateFn = (): Promise<boolean | UrlTree>=> {
    const router = inject(Router);
    
    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
            // 1度のみ実行する
            unsub();

            // ログインしていない場合は、ログイン画面にリダイレクト
            if (!user) {
                resolve(router.createUrlTree(['/login']));
                return;
            }
            resolve(true);
        })
    })
}