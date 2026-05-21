import { Injectable } from '@angular/core';

import { db } from '../../../core/firebase';
import { AppUserInput } from '../../auth/models/auth.model';
import {
    doc,
    serverTimestamp,
    setDoc,
 } from 'firebase/firestore';

@Injectable({
    providedIn: 'root',
})

export class UserService {
    // Firestoreにユーザーを登録
    async createUser(userInput: AppUserInput) {
        const docRef = doc(db, 'users', userInput.uid);
        await setDoc(docRef, {
            ...userInput,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    }
}