import { Injectable } from '@angular/core';

import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    Timestamp,
    serverTimestamp,
    query,
    getDocs,
    where,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { Employee, EmployeeInput } from '../models/employee.models';

@Injectable({
    providedIn: 'root',
})

export class EmployeeService {
    // Firestoreに従業員を登録
    async createEmployee(employeeInput: EmployeeInput): Promise<Employee> {
        const docRef = doc(collection(db, 'employees'));
        const createdAt = serverTimestamp() as Timestamp;
        const employee: Employee = {
            id: docRef.id,
            ...employeeInput,
            createdAt: createdAt,
            updatedAt: createdAt,
        }
        await setDoc(docRef, employee);
        return employee;
    }

    // companyIdから従業員を取得
    async getEmployeesByCompanyId(companyId: string): Promise<Employee[]> {
        const docRef = collection(db, 'employees');
        const q = query(docRef, where('companyId', '==', companyId));
        const docSnap = await getDocs(q);

        if(docSnap.empty) return [];

        const employees: Employee[] = [];
        docSnap.forEach((docSnap) => {
            employees.push({ id: docSnap.id, ...docSnap.data() } as Employee);
        });
        return employees;
    }

    // employeeIdから従業員を取得
    async getEmployeeById(employeeId: string): Promise<Employee | null> {
        const docRef = doc(db, 'employees', employeeId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return { id: employeeId, ...docSnap.data() } as Employee;
    }

    async updateEmployee(employeeId: string, employeeInput: EmployeeInput): Promise<void> {
        const docRef = doc(db, 'employees', employeeId);
        await updateDoc(docRef, {
            ...employeeInput,
            updatedAt: serverTimestamp(),
        });
    }
}