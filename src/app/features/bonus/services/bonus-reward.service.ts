import { Injectable, inject } from '@angular/core';
import {
    collection,
    deleteDoc,
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
import { normalizeBonusStatus } from '../utils/bonus-status.util';
import { EmployeeService } from '../../employee/services/employee.service';
import { bonusPaymentDateReason } from '../../insurance/utils/reward-target-month.util';

@Injectable({
    providedIn: 'root',
})
export class BonusRewardService {
    private readonly employeeService = inject(EmployeeService);
    private readonly collectionName = 'bonusRewards';

    async saveDraft(input: BonusRewardInput): Promise<BonusReward> {
        return this.upsertBonusReward(input, 'draft');
    }

    async confirm(input: BonusRewardInput): Promise<BonusReward> {
        return this.upsertBonusReward(input, 'confirmed');
    }

    async deleteDraftBonusReward(id: string): Promise<void> {
        const docRef = doc(db, this.collectionName, id);
        const existing = await getDoc(docRef);
        if (!existing.exists()) return;

        const bonus = { id: existing.id, ...existing.data() } as BonusReward;
        if (normalizeBonusStatus(bonus) !== 'draft') {
            throw new Error('確定済みの賞与は削除できません');
        }

        await deleteDoc(docRef);
    }

    async upsertBonusReward(
        input: BonusRewardInput,
        status: Extract<BonusRewardStatus, 'draft' | 'confirmed'>,
    ): Promise<BonusReward> {
        if (status === 'confirmed' && input.bonusAmount <= 0) {
            throw new Error('賞与額を入力してください');
        }

        const employee = await this.employeeService.getEmployeeById(input.employeeId);
        if (!employee) {
            throw new Error('従業員が見つかりません');
        }
        const periodReason = bonusPaymentDateReason(employee, input.paymentDate);
        if (periodReason) {
            throw new Error(periodReason);
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
