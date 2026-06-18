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
import {
    StandardMonthlyReward,
    StandardMonthlyRewardInput,
    StandardMonthlyRewardStatus,
} from '../models/standard-monthly-reward.model';
import { detectFixedWageChanges } from '../utils/fixed-wage-change.util';
import { addMonthsToYearMonth, isRewardTargetMonth, rewardTargetMonthReason } from '../utils/reward-target-month.util';
import { StandardMonthlyRewardCalculatorService } from './standard-monthly-reward-calculator.service';
import { EmployeeService } from '../../employee/services/employee.service';

@Injectable({
    providedIn: 'root',
})
export class StandardMonthlyRewardService {
    private readonly calculator = inject(StandardMonthlyRewardCalculatorService);
    private readonly employeeService = inject(EmployeeService);

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

    /** 下書きとして保存（入力途中でも保存可能） */
    async saveDraft(input: StandardMonthlyRewardInput): Promise<StandardMonthlyReward> {
        return this.upsert(input, 'draft');
    }

    /** 確定として保存（等級算定のバリデーションあり） */
    async confirm(input: StandardMonthlyRewardInput): Promise<StandardMonthlyReward> {
        return this.upsert(input, 'confirmed');
    }

    // 標準報酬月額を登録・更新
    async upsert(
        input: StandardMonthlyRewardInput,
        status: Extract<StandardMonthlyRewardStatus, 'draft' | 'confirmed'>,
    ): Promise<StandardMonthlyReward> {
        const employee = await this.employeeService.getEmployeeById(input.employeeId);
        if (!employee) {
            throw new Error('従業員が見つかりません');
        }
        if (!isRewardTargetMonth(employee, input.targetYearMonth)) {
            throw new Error(
                rewardTargetMonthReason(employee, input.targetYearMonth)
                    ?? 'この月は報酬登録の対象外です',
            );
        }

        const monthlyReward = input.monthlyRewardAmount ?? this.sumRewardFields(input);
        const calc = monthlyReward > 0 ? this.calculator.calculate(monthlyReward) : null;

        if (status === 'confirmed') {
            if (monthlyReward <= 0) {
                throw new Error('報酬月額を入力してください');
            }
            if (!calc?.health || !calc?.pension) {
                throw new Error('等級を判定できませんでした');
            }
        }

        const id = this.docId(input.employeeId, input.targetYearMonth);
        const docRef = doc(db, 'standardMonthlyRewards', id);
        const existing = await getDoc(docRef);

        const previousYm = addMonthsToYearMonth(input.targetYearMonth, -1);
        const previousRef = doc(db, 'standardMonthlyRewards', this.docId(input.employeeId, previousYm));
        const previousSnap = await getDoc(previousRef);
        const previous = previousSnap.exists()
            ? ({ ...previousSnap.data() } as StandardMonthlyReward)
            : null;
        const wageChange = detectFixedWageChanges(input, previous);

        const payload = {
            companyId: input.companyId,
            employeeId: input.employeeId,
            targetYearMonth: input.targetYearMonth,
            basicSalary: input.basicSalary,
            commutingAllowance: input.commutingAllowance,
            positionAllowance: input.positionAllowance,
            housingAllowance: input.housingAllowance,
            fixedOvertimePay: input.fixedOvertimePay,
            otherFixedAllowance: input.otherFixedAllowance,
            overtimePay: input.overtimePay,
            holidayPay: input.holidayPay,
            nightPay: input.nightPay,
            commissionPay: input.commissionPay,
            otherVariablePay: input.otherVariablePay,
            monthlyReward,
            healthInsuranceGrade: calc?.health?.grade ?? 0,
            healthInsuranceStandardMonthlyAmount: calc?.health?.standardMonthlyAmount ?? 0,
            pensionInsuranceGrade: calc?.pension?.grade ?? 0,
            pensionInsuranceStandardMonthlyAmount: calc?.pension?.standardMonthlyAmount ?? 0,
            fixedWageChanged: wageChange.fixedWageChanged,
            changedFixedWageFields: wageChange.changedFixedWageFields,
            status,
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

    // 報酬月額を計算
    private sumRewardFields(input: StandardMonthlyRewardInput): number {
        return (
            input.basicSalary +
            input.commutingAllowance +
            input.positionAllowance +
            input.housingAllowance +
            input.fixedOvertimePay +
            input.otherFixedAllowance +
            input.overtimePay +
            input.holidayPay +
            input.nightPay +
            input.commissionPay +
            input.otherVariablePay
        );
    }
}
