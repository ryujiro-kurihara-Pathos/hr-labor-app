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
import { Office, OfficeCreateInput, OfficeInput } from '../models/office.model';
import {
    generateRandomOfficeNumber,
    generateRandomOfficeSymbol,
    normalizeOfficeNumber,
    normalizeOfficeSymbol,
} from '../utils/office-format.util';
import { db } from '../../../core/firebase';

@Injectable({ providedIn: 'root' })

export class OfficeService {
    // 事業所の作成
    async createOffice(officeInput: OfficeCreateInput): Promise<Office> {
        const createdAt = serverTimestamp() as Timestamp;
        const docRef = doc(collection(db, 'offices'));
        const assigned = await this.assignOfficeSymbols(officeInput.companyId);

        const office: Office = {
            id: docRef.id,
            companyId: officeInput.companyId,
            name: officeInput.name,
            postalCode: officeInput.postalCode,
            prefecture: officeInput.prefecture,
            city: officeInput.city,
            streetAddress: officeInput.streetAddress,
            buildingName: officeInput.buildingName,
            phoneNumber: officeInput.phoneNumber,
            healthInsuranceType: officeInput.healthInsuranceType,
            officeSymbol: normalizeOfficeSymbol(
                officeInput.officeSymbol?.trim() || assigned.officeSymbol,
            ),
            officeNumber: normalizeOfficeNumber(
                officeInput.officeNumber?.trim() || assigned.officeNumber,
            ),
            regularWeeklyScheduledWorkHours: officeInput.regularWeeklyScheduledWorkHours,
            regularMonthlyScheduledWorkHours: officeInput.regularMonthlyScheduledWorkHours,
            regularWeeklyScheduledWorkDays: officeInput.regularWeeklyScheduledWorkDays,
            regularMonthlyScheduledWorkDays: officeInput.regularMonthlyScheduledWorkDays,
            status: officeInput.status,
            createdAt: createdAt,
            updatedAt: createdAt,
        };

        await setDoc(docRef, office);

        return office;
    }

    // companyIdから事業所を取得
    async getOfficesByCompanyId(companyId: string): Promise<Office[]> {
        const docRef = collection(db, 'offices');
        const q = query(docRef, where('companyId', '==', companyId));
        const docSnap = await getDocs(q);

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

        if (!docSnap.exists()) return null;

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

    private async assignOfficeSymbols(companyId: string): Promise<{
        officeSymbol: string;
        officeNumber: string;
    }> {
        const offices = await this.getOfficesByCompanyId(companyId);
        const existingSymbols = new Set(offices.map((office) => office.officeSymbol));
        const existingNumbers = new Set(offices.map((office) => office.officeNumber));

        let officeSymbol = generateRandomOfficeSymbol();
        for (let attempt = 0; attempt < 50 && existingSymbols.has(officeSymbol); attempt++) {
            officeSymbol = generateRandomOfficeSymbol();
        }

        let officeNumber = generateRandomOfficeNumber();
        for (let attempt = 0; attempt < 50 && existingNumbers.has(officeNumber); attempt++) {
            officeNumber = generateRandomOfficeNumber();
        }

        return { officeSymbol, officeNumber };
    }

    private normalizeOffice(id: string, data: Record<string, unknown>): Office {
        const rawSymbol = String(
            data['officeSymbol']
                ?? data['kyokaiInsuranceSymbol']
                ?? data['healthInsuranceOfficeSymbol']
                ?? '',
        );
        const legacyAddress = String(data['address'] ?? '').trim();
        const streetAddress = String(data['streetAddress'] ?? '').trim();

        return {
            id,
            companyId: String(data['companyId'] ?? ''),
            name: String(data['name'] ?? ''),
            postalCode: String(data['postalCode'] ?? ''),
            prefecture: String(data['prefecture'] ?? ''),
            city: String(data['city'] ?? ''),
            streetAddress: streetAddress || legacyAddress,
            buildingName: String(data['buildingName'] ?? ''),
            phoneNumber: String(data['phoneNumber'] ?? ''),
            healthInsuranceType: (data['healthInsuranceType'] as Office['healthInsuranceType']) ?? 'kyokai',
            officeSymbol: normalizeOfficeSymbol(rawSymbol),
            officeNumber: normalizeOfficeNumber(
                String(data['officeNumber'] ?? data['pensionOfficeNumber'] ?? ''),
            ),
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

