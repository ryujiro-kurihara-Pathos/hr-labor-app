import { Injectable } from '@angular/core';

import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    Timestamp,
    getDoc,
    deleteDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { Office, OfficeInput } from '../models/office.model';
import { db } from '../../../core/firebase';

@Injectable({ providedIn: 'root' })

export class OfficeService {
    // 事業所の作成
    async createOffice(officeInput: OfficeInput): Promise<Office> {
        // 作成日時の設定
        const createdAt = serverTimestamp() as Timestamp;

        // 事業所ドキュメントの作成
        const docRef = doc(collection(db, 'offices'));
        const office: Office = {
            id: docRef.id,
            ...officeInput,
            createdAt: createdAt,
            updatedAt: createdAt,
        }

        // 事業所をFirestoreに登録
        await setDoc(docRef, office);

        return office;
    }

    // companyIdから事業所を取得
    async getOfficesByCompanyId(companyId: string): Promise<Office[]> {
        // 事業所のコレクションを取得
        const docRef = collection(db, 'offices');
        
        // 事業所を取得
        const q = query(docRef, where('companyId', '==', companyId));
        const docSnap = await getDocs(q);

        // 事業所の配列を作成
        const offices: Office[] = [];
        docSnap.forEach((doc) => {
            offices.push(this.normalizeOffice(doc.id, doc.data()));
        });
        
        return offices;
    }

    // officeIdから事業所を取得
    async getOfficeById(officeId: string): Promise<Office | null> {
        const docRef = doc(db, 'offices', officeId);
        const docSnap = await getDoc(docRef);

        if(!docSnap.exists()) return null;

        return this.normalizeOffice(officeId, docSnap.data());
    }

    // 事業所の更新
    async updateOffice(officeId: string, officeInput: OfficeInput): Promise<void> {
        const docRef = doc(db, 'offices', officeId);
        await updateDoc(docRef, {
            ...officeInput,
            updatedAt: serverTimestamp(),
        });
    }

    // 事業所の削除
    async deleteOffice(officeId: string): Promise<void> {
        const docRef = doc(db, 'offices', officeId);
        await deleteDoc(docRef);
    }

    // 事業所の無効化
    async disableOffice(officeId: string): Promise<void> {
        const docRef = doc(db, 'offices', officeId);
        await updateDoc(docRef, {
            status: 'disabled',
            updatedAt: serverTimestamp(),
        });
    }

    // 事業所の有効化
    async enableOffice(officeId: string): Promise<void> {
        const docRef = doc(db, 'offices', officeId);
        await updateDoc(docRef, {
            status: 'active',
            updatedAt: serverTimestamp(),
        });
    }

    private normalizeOffice(id: string, data: Record<string, unknown>): Office {
        return {
            id,
            companyId: String(data['companyId'] ?? ''),
            name: String(data['name'] ?? ''),
            prefecture: String(data['prefecture'] ?? ''),
            address: String(data['address'] ?? ''),
            healthInsuranceType: (data['healthInsuranceType'] as Office['healthInsuranceType']) ?? 'kyokai',
            regularWeeklyScheduledWorkHours: this.toNullableNumber(data['regularWeeklyScheduledWorkHours']),
            regularMonthlyScheduledWorkHours: this.toNullableNumber(data['regularMonthlyScheduledWorkHours']),
            regularWeeklyScheduledWorkDays: this.toNullableNumber(data['regularWeeklyScheduledWorkDays']),
            regularMonthlyScheduledWorkDays: this.toNullableNumber(data['regularMonthlyScheduledWorkDays']),
            status: (data['status'] as Office['status']) ?? 'active',
            createdAt: data['createdAt'] as Office['createdAt'],
            updatedAt: data['updatedAt'] as Office['updatedAt'],
        };
    }

    private toNullableNumber(value: unknown): number | null {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }
}