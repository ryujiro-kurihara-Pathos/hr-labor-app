import { Injectable } from '@angular/core';

import { db } from '../../../core/firebase';
import { AppUser, AppUserInput } from '../models/user.model';
import {
    doc,
    serverTimestamp,
    setDoc,
    updateDoc,
    getDoc,
    collection,
    Timestamp,
    query,
    where,
    getDocs,
 } from 'firebase/firestore';

@Injectable({
    providedIn: 'root',
})

export class UserService {
    private normalizeUser(id: string, data: Record<string, unknown>): AppUser {
        return {
            id,
            uid: String(data['uid'] ?? id),
            lastName: String(data['lastName'] ?? ''),
            firstName: String(data['firstName'] ?? ''),
            lastNameKana: String(data['lastNameKana'] ?? ''),
            firstNameKana: String(data['firstNameKana'] ?? ''),
            email: String(data['email'] ?? ''),
            password: String(data['password'] ?? ''),
            passwordSet: Boolean(data['passwordSet'] ?? false),
            role: (data['role'] as AppUser['role']) ?? 'employee',
            status: (data['status'] as AppUser['status']) ?? 'active',
            companyId: String(data['companyId'] ?? ''),
            employeeId: (data['employeeId'] as string | null) ?? null,
            createdAt: data['createdAt'] as AppUser['createdAt'],
            updatedAt: data['updatedAt'] as AppUser['updatedAt'],
        };
    }

    // Firestoreにユーザーを登録
    async createUser(userInput: AppUserInput) {
        const docRef = doc(db, 'users', userInput.uid);
        const user: AppUser = {
            id: userInput.uid,
            ...userInput,
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
        }
        await setDoc(docRef, {
            ...userInput,
            email: userInput.email.trim().toLowerCase(),
            password: userInput.password ?? '',
            passwordSet: userInput.passwordSet ?? false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    }

    async setUserPassword(uid: string, password: string): Promise<void> {
        const docRef = doc(db, 'users', uid);
        await updateDoc(docRef, {
            password,
            passwordSet: true,
            updatedAt: serverTimestamp(),
        });
    }

    // uidからユーザーを取得
    async getUserByUid(uid: string): Promise<AppUser | null> {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        
        if(!docSnap.exists()) return null;

        return this.normalizeUser(uid, docSnap.data() as Record<string, unknown>);
    }

    async getUserByEmployeeId(employeeId: string): Promise<AppUser | null> {
        const col = collection(db, 'users');
        const q = query(col, where('employeeId', '==', employeeId));
        const snap = await getDocs(q);
        if (snap.empty) return null;

        const docSnap = snap.docs[0];
        return this.normalizeUser(docSnap.id, docSnap.data() as Record<string, unknown>);
    }

    async getUserByEmail(email: string): Promise<AppUser | null> {
        const normalized = email.trim().toLowerCase();
        if (!normalized) return null;

        const col = collection(db, 'users');
        const q = query(col, where('email', '==', normalized));
        const snap = await getDocs(q);
        if (snap.empty) return null;

        const docSnap = snap.docs[0];
        return this.normalizeUser(docSnap.id, docSnap.data() as Record<string, unknown>);
    }
}