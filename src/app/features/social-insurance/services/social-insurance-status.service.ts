import { Injectable } from '@angular/core';

import {
    doc,
    setDoc,
    getDocs,
    updateDoc,
    query,
    where,
    collection,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore'
import { db } from '../../../core/firebase';

import { SocialInsuranceStatus, SocialInsuranceStatusInput } from '../models/social-insurance-status.model';

@Injectable({
    providedIn: 'root',
})

export class SocialInsuranceStatusService {
    // Firestoreに社会保険情報を登録
    async createSocialInsuranceStatus(
        statusInput: SocialInsuranceStatusInput
    ): Promise<SocialInsuranceStatus> {
        const docRef = doc(collection(db, 'socialInsuranceStatuses'));

        const socialInsuranceStatus: SocialInsuranceStatus = {
            id: docRef.id,
            ...statusInput,
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
        }
        await setDoc(docRef, socialInsuranceStatus);
        return socialInsuranceStatus;
    }

    // employeeIdから社会保険情報を取得
    async getByEmployeeId(employeeId: string): Promise<SocialInsuranceStatus | null> {
        const docRef = collection(db, 'socialInsuranceStatuses');
        const q = query(docRef, where('employeeId', '==', employeeId));
        const docSnap = await getDocs(q);
        if (docSnap.empty) return null;

        const snapshot = docSnap.docs[0];
        return { id: snapshot.id, ...snapshot.data() } as SocialInsuranceStatus;
    }

    // 社会保険情報を更新
    async updateSocialInsuranceStatus(id: string, socialInsuranceStatusInput: SocialInsuranceStatusInput): Promise<void> {
        const docRef = doc(db, 'socialInsuranceStatuses', id);
        await updateDoc(docRef, {
            ...socialInsuranceStatusInput,
            updatedAt: serverTimestamp(),
        });
    }
}