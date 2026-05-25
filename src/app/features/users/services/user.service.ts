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
    // Firestoreにユーザーを登録
    async createUser(userInput: AppUserInput) {
        const docRef = doc(db, 'users', userInput.uid);
        const user: AppUser = {
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

        return docSnap.data() as AppUser;
    }
}