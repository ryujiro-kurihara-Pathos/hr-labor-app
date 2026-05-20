import { Injectable } from '@angular/core';

import { signOut } from 'firebase/auth';
import { auth } from '../../../firebase';

@Injectable({
    providedIn: 'root',
})

export class AuthService {
    // ログアウト
    async logout(): Promise<void> {
        await signOut(auth);
    }
}