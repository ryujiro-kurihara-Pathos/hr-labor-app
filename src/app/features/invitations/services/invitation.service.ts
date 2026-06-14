import { Injectable } from '@angular/core';

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    Timestamp,
    updateDoc,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';

import { Invitation, InvitationInput } from '../models/invitation.model';
import { isInvitationExpired } from '../utils/invitation.util';

@Injectable({
    providedIn: 'root',
})
export class InvitationService {
    private normalizeInvitation(id: string, data: Record<string, unknown>): Invitation {
        return {
            id,
            email: String(data['email'] ?? ''),
            companyId: String(data['companyId'] ?? ''),
            employeeId: String(data['employeeId'] ?? ''),
            role: (data['role'] as Invitation['role']) ?? 'employee',
            status: (data['status'] as Invitation['status']) ?? 'pending',
            invitedBy: String(data['invitedBy'] ?? ''),
            createdAt: data['createdAt'] as Invitation['createdAt'],
            updatedAt: data['updatedAt'] as Invitation['updatedAt'],
            expiresAt: data['expiresAt'] as Invitation['expiresAt'],
        };
    }

    async createInvitation(invitationInput: InvitationInput): Promise<Invitation> {
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 7);

        const invitationRef = doc(collection(db, 'invitations'));
        const payload = {
            ...invitationInput,
            status: 'pending' as const,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            expiresAt: Timestamp.fromDate(expiresAt),
        };

        await setDoc(invitationRef, payload);

        const created = await getDoc(invitationRef);
        return this.normalizeInvitation(invitationRef.id, created.data() as Record<string, unknown>);
    }

    async getInvitationById(invitationId: string): Promise<Invitation | null> {
        const docRef = doc(db, 'invitations', invitationId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return this.normalizeInvitation(snap.id, snap.data() as Record<string, unknown>);
    }

    async getPendingInvitationByEmployeeId(employeeId: string): Promise<Invitation | null> {
        const col = collection(db, 'invitations');
        const q = query(
            col,
            where('employeeId', '==', employeeId),
            where('status', '==', 'pending'),
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;

        const invitations = snap.docs
            .map((docSnap) => this.normalizeInvitation(docSnap.id, docSnap.data() as Record<string, unknown>))
            .filter((invitation) => !isInvitationExpired(invitation))
            .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

        return invitations[0] ?? null;
    }

    async markInvitationAccepted(invitationId: string): Promise<void> {
        const docRef = doc(db, 'invitations', invitationId);
        await updateDoc(docRef, {
            status: 'accepted',
            updatedAt: serverTimestamp(),
        });
    }

    async cancelPendingInvitationsForEmployee(employeeId: string): Promise<void> {
        const col = collection(db, 'invitations');
        const q = query(
            col,
            where('employeeId', '==', employeeId),
            where('status', '==', 'pending'),
        );
        const snap = await getDocs(q);

        await Promise.all(
            snap.docs.map((docSnap) =>
                updateDoc(docSnap.ref, {
                    status: 'rejected',
                    updatedAt: serverTimestamp(),
                }),
            ),
        );
    }
}
