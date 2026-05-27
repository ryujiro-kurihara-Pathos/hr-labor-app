import { Injectable } from '@angular/core';

import {
    doc,
    setDoc,
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

    
}