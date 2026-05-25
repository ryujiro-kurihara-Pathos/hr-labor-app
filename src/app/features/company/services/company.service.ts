import { Injectable } from '@angular/core';

import {
    collection,
    doc,
    serverTimestamp,
    setDoc,
    getDoc,
    Timestamp } from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { Company, CompanyInput } from '../models/company.model';

@Injectable({
    providedIn: 'root',
})

export class CompanyService {
    // Firestoreに会社情報を登録
    async createCompany(companyInput: CompanyInput): Promise<Company> {
        const createdAt = serverTimestamp();
        const updatedAt = serverTimestamp();

        const docRef = doc(collection(db, 'companies'));
        await setDoc(docRef, {
            ...companyInput,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        const company: Company = {
            id: docRef.id,
            ...companyInput,
            createdAt: createdAt as Timestamp,
            updatedAt: updatedAt as Timestamp,
        }
        return company;
    }

    // companyIdから会社情報を取得
    async getCompanyById(companyId: string): Promise<Company | null> {
        const docRef = doc(collection(db, 'companies'), companyId);
        const docSnap = await getDoc(docRef);
        
        if(!docSnap.exists()) return null;

        const company = {
            id: companyId,
            ...docSnap.data(),
        } as Company;

        console.log(company);

        return company;
    }
}