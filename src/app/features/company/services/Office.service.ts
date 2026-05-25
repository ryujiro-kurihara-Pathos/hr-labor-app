import { Injectable } from '@angular/core';

import {
    collection,
    doc,
    setDoc,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { Office, OfficeInput } from '../models/office.model';
import { db } from '../../../core/firebase';

@Injectable({ providedIn: 'root' })

export class OfficeService {
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
}