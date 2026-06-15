import { Injectable } from '@angular/core';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';

import { db } from '../../../core/firebase';
import {
    BonusReward,
    BonusRewardInput,
    BonusRewardStatus,
} from '../models/bonus-reward.model';

@Injectable({
    providedIn: 'root',
})
export class BonusRewardService {
    private readonly collectionName = 'bonusRewards';

    async saveDraft(input: BonusRewardInput): Promise<BonusReward> {
        return this.upsertBonusReward(input, 'draft');
    }

    async confirm(input: BonusRewardInput): Promise<BonusReward> {
        return this.upsertBonusReward(input, 'confirmed');
    }

    async upsertBonusReward(
        input: BonusRewardInput,
        status: Extract<BonusRewardStatus, 'draft' | 'confirmed'>,
    ): Promise<BonusReward> {
        if (status === 'confirmed' && input.bonusAmount <= 0) {
            throw new Error('賞与額を入力してください');
        }

        const standardBonusAmount = this.calculateStandardBonusAmount(input.bonusAmount);
        const docId = `${input.companyId}_${input.employeeId}_${input.paymentDate}`;
        const docRef = doc(db, this.collectionName, docId);
        const existing = await getDoc(docRef);

        const payload = {
            companyId: input.companyId,
            employeeId: input.employeeId,
            paymentDate: input.paymentDate,
            targetYearMonth: input.targetYearMonth,
            bonusAmount: input.bonusAmount,
            standardBonusAmount,
            status,
        };

        if (!existing.exists()) {
            const createdAt = serverTimestamp() as Timestamp;
            const bonusReward: BonusReward = {
                id: docId,
                ...payload,
                createdAt,
                updatedAt: createdAt,
            };
            await setDoc(docRef, bonusReward);
            return bonusReward;
        }

        await updateDoc(docRef, {
            ...payload,
            updatedAt: serverTimestamp(),
        });
        const after = await getDoc(docRef);
        return { id: after.id, ...after.data() } as BonusReward;
    }

    async getBonusRewardsByCompanyAndYearMonth(
        companyId: string,
        targetYearMonth: string,
    ): Promise<BonusReward[]> {
        const q = query(
            collection(db, this.collectionName),
            where('companyId', '==', companyId),
            where('targetYearMonth', '==', targetYearMonth),
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map((docSnap) => {
            return docSnap.data() as BonusReward;
        });
    }

    async getBonusRewardsByEmployee(
        companyId: string,
        employeeId: string,
    ): Promise<BonusReward[]> {
        const q = query(
            collection(db, this.collectionName),
            where('companyId', '==', companyId),
            where('employeeId', '==', employeeId),
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map((docSnap) => {
            return docSnap.data() as BonusReward;
        });
    }

    calculateStandardBonusAmount(bonusAmount: number): number {
        return Math.floor(bonusAmount / 1000) * 1000;
    }
}
