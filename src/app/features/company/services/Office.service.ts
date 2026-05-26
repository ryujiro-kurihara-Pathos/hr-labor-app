import { Injectable } from '@angular/core';

import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    Timestamp,
    getDoc,
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
            offices.push(doc.data() as Office);
        });
        
        return offices;
    }

    // officeIdから事業所を取得
    async getOfficeById(officeId: string): Promise<Office | null> {
        const docRef = doc(db, 'offices', officeId);
        const docSnap = await getDoc(docRef);

        if(!docSnap.exists()) return null;

        const office = {
            id: officeId,
            ...docSnap.data(),
        } as Office;

        return office;
    }
}