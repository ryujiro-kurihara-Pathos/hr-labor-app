import { Injectable } from '@angular/core';

import { db } from '../../../core/firebase';
import {
    collection,
    doc,
    setDoc,
    serverTimestamp,
    Timestamp,
    getDoc,
    getDocs,
    query,
    where,
    updateDoc,
} from 'firebase/firestore';

import { Procedure, ProcedureInput } from '../models/procedures.model';

@Injectable({
    providedIn: 'root',
})

export class SocialInsuranceProcedureService {
    private readonly collectionName = 'socialInsuranceProcedures';

    // Firestoreに手続きを登録
    async createProcedure(input: ProcedureInput): Promise<Procedure> {
        const docRef = doc(collection(db, this.collectionName));
        const createdAt = serverTimestamp() as Timestamp;
        const procedure: Procedure = {
            id: docRef.id,
            ...input,
            createdAt: createdAt,
            updatedAt: createdAt,
        };
        await setDoc(docRef, procedure);
        return procedure;
    }

    // 手続き一覧を取得
    async getProcedures(): Promise<Procedure[]> {
        const docRef = collection(db, this.collectionName);
        const snapshot = await getDocs(docRef);
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Procedure));
    }

    // 手続きを1件取得
    async getProcedureById(procedureId: string): Promise<Procedure | null> {
        const docRef = doc(db, this.collectionName, procedureId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        return { id: procedureId, ...snapshot.data() } as Procedure;
    }

    // employeeIdから資格取得手続きを取得
    async getQualificationProcedureByEmployeeId(employeeId: string, companyId: string): Promise<Procedure | null> {
        const docRef = collection(db, this.collectionName);
        const q = query(docRef, where('employeeId', '==', employeeId), where('companyId', '==', companyId), where('procedureType', '==', 'qualification'));
        const snapshot = await getDocs(q);
        if(snapshot.empty) return null;

        const procedure = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Procedure;
        return procedure;
    }

    // 手続きを更新
    async updateProcedure(procedure: Procedure): Promise<void> {
        const id = procedure.id;
        const docRef = doc(db, this.collectionName, id);
        const updatedAt = serverTimestamp() as Timestamp;
        
        await updateDoc(docRef, procedure);
    }
}