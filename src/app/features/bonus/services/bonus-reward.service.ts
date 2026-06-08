import { Injectable } from '@angular/core';
import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    where,
} from 'firebase/firestore';

import { db } from '../../../core/firebase';
import {
    BonusReward,
    BonusRewardInput,
} from '../models/bonus-reward.model';

@Injectable({
    providedIn: 'root',
})

export class BonusRewardService {
    private readonly collectionName = 'bonusRewards';

    // 賞与を登録・更新
    async upsertBonusReward(input: BonusRewardInput): Promise<BonusReward> {
        const standardBonusAmount = this.calculateStandardBonusAmount(input.bonusAmount);
        const docId = `${input.companyId}_${input.employeeId}_${input.paymentDate}`;
        const docRef = doc(db, this.collectionName, docId);

        const bonusReward: BonusReward = {
            id: docId,
            companyId: input.companyId,
            employeeId: input.employeeId,
            paymentDate: input.paymentDate,
            targetYearMonth: input.targetYearMonth,
            bonusAmount: input.bonusAmount,
            standardBonusAmount: standardBonusAmount,
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
        };

        await setDoc(docRef, bonusReward);
        return bonusReward;
    }

    // 会社IDと対象年月で賞与を取得
    async getBonusRewardsByCompanyAndYearMonth(
        companyId: string,
        targetYearMonth: string
    ): Promise<BonusReward[]> {
        const q = query(
            collection(db, this.collectionName),
            where('companyId', '==', companyId),
            where('targetYearMonth', '==', targetYearMonth)
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map((docSnap) => {
            return docSnap.data() as BonusReward;
        });
    }

    // 会社IDと従業員IDで賞与を取得
    async getBonusRewardsByEmployee(
        companyId: string,
        employeeId: string
    ): Promise<BonusReward[]> {
        const q = query(
            collection(db, this.collectionName),
            where('companyId', '==', companyId),
            where('employeeId', '==', employeeId)
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map((docSnap) => {
            return docSnap.data() as BonusReward;
        });
    }

    // 賞与額から標準賞与額を計算（1000円未満切り捨て）
    calculateStandardBonusAmount(bonusAmount: number): number {
        return Math.floor(bonusAmount / 1000) * 1000;
    }
}