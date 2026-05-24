import { Injectable } from '@angular/core';

import {
    signInWithEmailAndPassword,
    signOut,
    createUserWithEmailAndPassword,
    updateProfile,
    User,
    onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../../../core/firebase';
import { InitialAdminSignupInput } from '../models/auth.model';

@Injectable({
    providedIn: 'root',
})

export class AuthService {
    // ログイン
    async login(email: string, password: string): Promise<User> {
        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password,
        );
        return userCredential.user;
    }

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

    // Authユーザーの取得
    getCurrentAuthUser(): User | null {
        return auth.currentUser;
    }

    // ログイン状態の監視
    watchAuthState(callback: (user: User | null) => void) {
        return onAuthStateChanged(auth, callback);
    }
}