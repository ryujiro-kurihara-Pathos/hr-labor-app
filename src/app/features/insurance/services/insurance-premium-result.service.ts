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
    InsurancePremiumResult,
    InsurancePremiumResultInput,
} from '../models/insurance-premium-result.model';

@Injectable({
    providedIn: 'root',
})
export class InsurancePremiumResultService {
    private docId(employeeId: string, targetYearMonth: string): string {
        return `${employeeId}_${targetYearMonth}`;
    }

    async getByEmployeeAndMonth(
        employeeId: string,
        targetYearMonth: string,
    ): Promise<InsurancePremiumResult | null> {
        const docRef = doc(db, 'insurancePremiumResults', this.docId(employeeId, targetYearMonth));
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as InsurancePremiumResult;
    }

    async listByCompanyAndMonth(
        companyId: string,
        targetYearMonth: string,
    ): Promise<InsurancePremiumResult[]> {
        const q = query(
            collection(db, 'insurancePremiumResults'),
            where('companyId', '==', companyId),
            where('targetYearMonth', '==', targetYearMonth),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InsurancePremiumResult));
    }

    async save(input: InsurancePremiumResultInput): Promise<InsurancePremiumResult> {
        const id = this.docId(input.employeeId, input.targetYearMonth);
        const docRef = doc(db, 'insurancePremiumResults', id);
        const existing = await getDoc(docRef);

        const payload = {
            companyId: input.companyId,
            employeeId: input.employeeId,
            targetYearMonth: input.targetYearMonth,
            standardMonthlyAmount: input.standardMonthlyAmount,
            healthInsuranceEmployeePremium: input.healthInsuranceEmployeePremium,
            healthInsuranceEmployerPremium: input.healthInsuranceEmployerPremium,
            pensionInsuranceEmployeePremium: input.pensionInsuranceEmployeePremium,
            pensionInsuranceEmployerPremium: input.pensionInsuranceEmployerPremium,
            careInsuranceEmployeePremium: input.careInsuranceEmployeePremium,
            careInsuranceEmployerPremium: input.careInsuranceEmployerPremium,
            monthlyEmployeePremiumTotal: input.monthlyEmployeePremiumTotal,
            monthlyEmployerPremiumTotal: input.monthlyEmployerPremiumTotal,
            bonusEmployeePremiumTotal: input.bonusEmployeePremiumTotal,
            bonusEmployerPremiumTotal: input.bonusEmployerPremiumTotal,
            totalEmployeePremium: input.totalEmployeePremium,
            totalEmployerPremium: input.totalEmployerPremium,
        };

        if (!existing.exists()) {
            const createdAt = serverTimestamp() as Timestamp;
            const result: InsurancePremiumResult = {
                id,
                ...payload,
                createdAt,
                updatedAt: createdAt,
            };
            await setDoc(docRef, result);
            return result;
        }

        await updateDoc(docRef, {
            ...payload,
            updatedAt: serverTimestamp(),
        });
        const after = await getDoc(docRef);
        return { id: after.id, ...after.data() } as InsurancePremiumResult;
    }

    sumEmployerPremium(results: InsurancePremiumResult[]): number {
        return results.reduce((sum, result) => sum + result.totalEmployerPremium, 0);
    }
}
