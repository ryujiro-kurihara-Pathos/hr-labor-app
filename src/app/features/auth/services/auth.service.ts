import { Injectable } from '@angular/core';

import { signOut, createUserWithEmailAndPassword, updateProfile, User } from 'firebase/auth';
import { auth } from '../../../core/firebase';
import { InitialAdminSignupInput } from '../models/auth.model';

@Injectable({
    providedIn: 'root',
})

export class AuthService {
    // ログアウト
    async logout(): Promise<void> {
        await signOut(auth);
    }

    // 初期管理者ユーザー作成
    async createInitialAdminUser(input: InitialAdminSignupInput): Promise<User> {
        // Authenticationにユーザーを作成
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            input.email,
            input.password,
        );

        const user = userCredential.user;
        
        await updateProfile(user, {
            displayName: `${input.lastName} ${input.firstName}`,
        });

        return user;
    }


}