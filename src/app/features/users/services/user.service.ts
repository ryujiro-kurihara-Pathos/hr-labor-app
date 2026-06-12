import { Injectable } from '@angular/core';

import { db } from '../../../core/firebase';
import { AppUser, AppUserInput } from '../models/user.model';
import {
    doc,
    serverTimestamp,
    setDoc,
    getDoc,
    collection,
    Timestamp,
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
            createdAt: serverTimestamp(),
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
}