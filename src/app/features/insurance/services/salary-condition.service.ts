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
import { SalaryCondition, SalaryConditionInput } from '../models/salary-condition.model';
import {
    fixedWageTotalFromForm,
    resolvePreviousSalaryCondition,
    salaryConditionDocId,
    shouldTriggerRevisionFromSalaryCondition,
} from '../utils/salary-condition.util';
import { sumFixedWageFields } from '../utils/fixed-wage-change.util';

@Injectable({
    providedIn: 'root',
})
export class SalaryConditionService {
    async listByEmployee(employeeId: string): Promise<SalaryCondition[]> {
        const col = collection(db, 'salaryConditions');
        const q = query(col, where('employeeId', '==', employeeId));
        const snap = await getDocs(q);
        const list = snap.docs.map((item) => ({ id: item.id, ...item.data() } as SalaryCondition));
        return list.sort((a, b) => (a.effectiveStartMonth < b.effectiveStartMonth ? -1 : 1));
    }

    async getByEmployeeAndMonth(
        employeeId: string,
        effectiveStartMonth: string,
    ): Promise<SalaryCondition | null> {
        const docRef = doc(db, 'salaryConditions', salaryConditionDocId(employeeId, effectiveStartMonth));
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SalaryCondition;
    }

    async save(input: SalaryConditionInput): Promise<SalaryCondition> {
        const id = salaryConditionDocId(input.employeeId, input.effectiveStartMonth);
        const docRef = doc(db, 'salaryConditions', id);
        const existing = await getDoc(docRef);
        const allConditions = await this.listByEmployee(input.employeeId);
        const previous = resolvePreviousSalaryCondition(
            allConditions.filter((condition) => condition.id !== id),
            input.effectiveStartMonth,
        );

        const fixedWageTotal = sumFixedWageFields(input);
        const triggersRevision = shouldTriggerRevisionFromSalaryCondition(input, previous);

        const payload = {
            companyId: input.companyId,
            employeeId: input.employeeId,
            effectiveStartMonth: input.effectiveStartMonth,
            basicSalary: input.basicSalary,
            commutingAllowance: input.commutingAllowance,
            positionAllowance: input.positionAllowance,
            housingAllowance: input.housingAllowance,
            fixedOvertimePay: input.fixedOvertimePay,
            otherFixedAllowance: input.otherFixedAllowance,
            fixedWageTotal,
            triggersRevision,
            note: input.note,
            changeReason: input.changeReason,
        };

        if (!existing.exists()) {
            const createdAt = serverTimestamp() as Timestamp;
            const condition: SalaryCondition = {
                id,
                ...payload,
                createdAt,
                updatedAt: createdAt,
            };
            await setDoc(docRef, condition);
            return condition;
        }

        await updateDoc(docRef, {
            ...payload,
            updatedAt: serverTimestamp(),
        });
        const after = await getDoc(docRef);
        return { id: after.id, ...after.data() } as SalaryCondition;
    }
}

export function salaryConditionFixedWageTotalFromInput(input: SalaryConditionInput): number {
    return sumFixedWageFields(input);
}

export function salaryConditionFixedWageTotalFromFormLike(input: {
    basicSalary: number | '';
    commutingAllowance: number | '';
    positionAllowance: number | '';
    housingAllowance: number | '';
    fixedOvertimePay: number | '';
    otherFixedAllowance: number | '';
}): number {
    return fixedWageTotalFromForm({
        effectiveStartMonth: '',
        note: '',
        changeReason: '',
        ...input,
    });
}
