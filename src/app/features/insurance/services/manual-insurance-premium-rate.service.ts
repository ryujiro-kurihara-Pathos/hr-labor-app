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
    ManualInsurancePremiumRates,
    ManualInsurancePremiumRatesInput,
} from '../models/manual-insurance-premium-rate.model';

@Injectable({
    providedIn: 'root',
})
export class ManualInsurancePremiumRateService {
    private docId(employeeId: string, liabilityYearMonth: string): string {
        return `${employeeId}_${liabilityYearMonth}`;
    }

    async getByEmployeeAndLiabilityMonth(
        employeeId: string,
        liabilityYearMonth: string,
    ): Promise<ManualInsurancePremiumRates | null> {
        const docRef = doc(db, 'manualInsurancePremiumRates', this.docId(employeeId, liabilityYearMonth));
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as ManualInsurancePremiumRates;
    }

    async listByCompanyAndLiabilityMonth(
        companyId: string,
        liabilityYearMonth: string,
    ): Promise<ManualInsurancePremiumRates[]> {
        const q = query(
            collection(db, 'manualInsurancePremiumRates'),
            where('companyId', '==', companyId),
            where('liabilityYearMonth', '==', liabilityYearMonth),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ManualInsurancePremiumRates));
    }

    async save(input: ManualInsurancePremiumRatesInput): Promise<ManualInsurancePremiumRates> {
        const id = this.docId(input.employeeId, input.liabilityYearMonth);
        const docRef = doc(db, 'manualInsurancePremiumRates', id);
        const existing = await getDoc(docRef);

        const payload = {
            companyId: input.companyId,
            employeeId: input.employeeId,
            liabilityYearMonth: input.liabilityYearMonth,
            healthEmployeeRate: input.healthEmployeeRate,
            healthEmployerRate: input.healthEmployerRate,
            careEmployeeRate: input.careEmployeeRate,
            careEmployerRate: input.careEmployerRate,
            pensionEmployeeRate: input.pensionEmployeeRate,
            pensionEmployerRate: input.pensionEmployerRate,
        };

        if (!existing.exists()) {
            const createdAt = serverTimestamp() as Timestamp;
            const result: ManualInsurancePremiumRates = {
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
        return { id: after.id, ...after.data() } as ManualInsurancePremiumRates;
    }
}
