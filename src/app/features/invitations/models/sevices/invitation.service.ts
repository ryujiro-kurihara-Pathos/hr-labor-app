import { Injectable } from '@angular/core';

import {
    collection,
    doc,
    setDoc,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../../../../core/firebase';

import { Invitation, InvitationInput } from '../invitation.model';

@Injectable({
    providedIn: 'root',
})

export class InvitationService {
    async createInvitation(invitationInput: InvitationInput): Promise<Invitation> {
        // 招待期限の設定
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 7);
        // 作成日時の設定
        const createdAt = serverTimestamp() as Timestamp;
        
        // 招待ドキュメントの作成
        const invitationRef = doc(collection(db, 'invitations'));
        const invitation: Invitation = {
            id: invitationRef.id,
            ...invitationInput,
            status: 'pending',
            createdAt: createdAt,
            updatedAt: createdAt,
            expiresAt: Timestamp.fromDate(expiresAt),
        }

        // 招待ドキュメントの作成
        await setDoc(invitationRef, invitation);

        return invitation;
    }
}