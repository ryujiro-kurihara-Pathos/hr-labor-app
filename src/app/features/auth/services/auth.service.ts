import { Injectable } from '@angular/core';

import {
    signInWithEmailAndPassword,
    signOut,
    createUserWithEmailAndPassword,
    updateProfile,
    updatePassword,
    User,
    onAuthStateChanged,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    sendEmailVerification,
    reload,
    ActionCodeSettings,
} from 'firebase/auth';
import { auth } from '../../../core/firebase';
import { InitialAdminSignupInput } from '../models/auth.model';
import {
    EMAIL_FOR_SIGN_IN_KEY,
    normalizeAuthEmail,
} from '../utils/email-link-auth.util';

@Injectable({
    providedIn: 'root',
})

export class AuthService {
    async login(email: string, password: string): Promise<User> {
        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password,
        );
        return userCredential.user;
    }

    async logout(): Promise<void> {
        await signOut(auth);
    }

    async createInitialAdminUser(input: InitialAdminSignupInput): Promise<User> {
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

    async sendSignInLink(email: string, continueUrl: string): Promise<void> {
        const normalizedEmail = normalizeAuthEmail(email);
        const actionCodeSettings: ActionCodeSettings = {
            url: continueUrl,
            handleCodeInApp: true,
        };

        await sendSignInLinkToEmail(auth, normalizedEmail, actionCodeSettings);
        window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, normalizedEmail);
    }

    isEmailSignInLink(href: string): boolean {
        return isSignInWithEmailLink(auth, href);
    }

    async signInWithEmailLink(email: string, emailLink: string): Promise<User> {
        const normalizedEmail = normalizeAuthEmail(email);
        const userCredential = await signInWithEmailLink(auth, normalizedEmail, emailLink);
        window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
        return userCredential.user;
    }

    async setPassword(password: string): Promise<void> {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('NOT_AUTHENTICATED');
        }

        await updatePassword(user, password);
    }

    getStoredEmailForSignIn(): string {
        return window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)?.trim() ?? '';
    }

    getCurrentAuthUser(): User | null {
        return auth.currentUser;
    }

    async sendVerificationEmail(): Promise<void> {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('NOT_AUTHENTICATED');
        }

        const actionCodeSettings: ActionCodeSettings = {
            url: `${window.location.origin}/login`,
            handleCodeInApp: false,
        };
        await sendEmailVerification(user, actionCodeSettings);
    }

    async isEmailVerified(): Promise<boolean> {
        const user = auth.currentUser;
        if (!user) return false;
        await reload(user);
        return auth.currentUser?.emailVerified ?? false;
    }

    watchAuthState(callback: (user: User | null) => void) {
        return onAuthStateChanged(auth, callback);
    }
}
