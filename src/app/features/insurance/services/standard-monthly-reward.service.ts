import { Injectable, inject } from '@angular/core';

import {
    doc,
    getDoc,
    getDocs,
    query,
    where,
    collection,
    serverTimestamp,
    setDoc,
    updateDoc,
    Timestamp,
} from 'firebase/firestore';

import { db } from '../../../core/firebase';
import { StandardMonthlyReward, StandardMonthlyRewardInput } from '../models/standard-monthly-reward.model';
import { StandardMonthlyRewardCalculatorService } from './standard-monthly-reward-calculator.service';

@Injectable({
    providedIn: 'root',
})
export class StandardMonthlyRewardService {
    private readonly calculator = inject(StandardMonthlyRewardCalculatorService);

    private docId(employeeId: string, targetYearMonth: string): string {
        return `${employeeId}_${targetYearMonth}`;
    }

    async getByEmployeeAndMonth(
        employeeId: string,
        targetYearMonth: string,
    ): Promise<StandardMonthlyReward | null> {
        const docRef = doc(db, 'standardMonthlyRewards', this.docId(employeeId, targetYearMonth));
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as StandardMonthlyReward;
    }

    async listByEmployee(employeeId: string): Promise<StandardMonthlyReward[]> {
        const col = collection(db, 'standardMonthlyRewards');
        const q = query(col, where('employeeId', '==', employeeId));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StandardMonthlyReward));
        return list.sort((a, b) => (a.targetYearMonth < b.targetYearMonth ? 1 : -1));
    }

    /** 対象年月の標準報酬月額を一括取得（employeeId でマップ化して使う） */
    async listByTargetYearMonth(targetYearMonth: string): Promise<StandardMonthlyReward[]> {
        const col = collection(db, 'standardMonthlyRewards');
        const q = query(col, where('targetYearMonth', '==', targetYearMonth));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StandardMonthlyReward));
    }

    /** 複数年月の標準報酬月額を一括取得（Firestore `in` は最大10件） */
    async listByTargetYearMonths(targetYearMonths: string[]): Promise<StandardMonthlyReward[]> {
        const unique = [...new Set(targetYearMonths.filter(Boolean))];
        if (unique.length === 0) return [];

        const results: StandardMonthlyReward[] = [];
        const col = collection(db, 'standardMonthlyRewards');

        for (let i = 0; i < unique.length; i += 10) {
            const chunk = unique.slice(i, i + 10);
            const q = query(col, where('targetYearMonth', 'in', chunk));
            const snap = await getDocs(q);
            results.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() } as StandardMonthlyReward)));
        }

        return results;
    }

    async upsert(input: StandardMonthlyRewardInput): Promise<StandardMonthlyReward> {
        const monthlyReward = this.sumRewardFields(input);
        const calc = this.calculator.calculate(monthlyReward);

        if (monthlyReward <= 0) {
            throw new Error('報酬月額を入力してください');
        }
        if (!calc.health || !calc.pension) {
            throw new Error('等級を判定できませんでした');
        }

        const id = this.docId(input.employeeId, input.targetYearMonth);
        const docRef = doc(db, 'standardMonthlyRewards', id);
        const existing = await getDoc(docRef);

        const payload = {
            employeeId: input.employeeId,
            targetYearMonth: input.targetYearMonth,
            basicSalary: input.basicSalary,
            commutingAllowance: input.commutingAllowance,
            monthlyAllowance: input.monthlyAllowance,
            positionAllowance: input.positionAllowance,
            housingAllowance: input.housingAllowance,
            fixedOvertimePay: input.fixedOvertimePay,
            monthlyReward,
            healthInsuranceGrade: calc.health.grade,
            healthInsuranceStandardMonthlyAmount: calc.health.standardMonthlyAmount,
            pensionInsuranceGrade: calc.pension.grade,
            pensionInsuranceStandardMonthlyAmount: calc.pension.standardMonthlyAmount,
        };

        if (!existing.exists()) {
            const createdAt = serverTimestamp() as Timestamp;
            const standardMonthlyReward: StandardMonthlyReward = {
                id,
                ...payload,
                createdAt,
                updatedAt: createdAt,
            };
            await setDoc(docRef, standardMonthlyReward);
            return standardMonthlyReward;
        }

        await updateDoc(docRef, {
            ...payload,
            updatedAt: serverTimestamp(),
        });
        const after = await getDoc(docRef);
        return { id: after.id, ...after.data() } as StandardMonthlyReward;
    }

    private sumRewardFields(input: StandardMonthlyRewardInput): number {
        return (
            input.basicSalary +
            input.commutingAllowance +
            input.monthlyAllowance +
            input.positionAllowance +
            input.housingAllowance +
            input.fixedOvertimePay
        );
    }
}
