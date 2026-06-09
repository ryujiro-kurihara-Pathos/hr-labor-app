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
import { Dependent, Employee, EmployeeInput } from '../models/employee.models';

@Injectable({
    providedIn: 'root',
})

export class EmployeeService {

    private toEmployee(id: string, data: Record<string, unknown>): Employee {
        const gender = data['gender'];
        return {
            id,
            companyId: String(data['companyId'] ?? ''),
            officeId: String(data['officeId'] ?? ''),
            employeeNumber: String(data['employeeNumber'] ?? ''),
            lastName: String(data['lastName'] ?? ''),
            firstName: String(data['firstName'] ?? ''),
            lastNameKana: String(data['lastNameKana'] ?? ''),
            firstNameKana: String(data['firstNameKana'] ?? ''),
            gender: gender === 'female' ? 'female' : 'male',
            postalCode: String(data['postalCode'] ?? ''),
            prefecture: String(data['prefecture'] ?? ''),
            city: String(data['city'] ?? ''),
            streetAddress: String(data['streetAddress'] ?? data['address'] ?? ''),
            buildingName: String(data['buildingName'] ?? ''),
            roomNumber: String(data['roomNumber'] ?? ''),
            phoneNumber: String(data['phoneNumber'] ?? ''),
            birthDate: String(data['birthDate'] ?? ''),
            joinedDate: String(data['joinedDate'] ?? ''),
            dependents: Array.isArray(data['dependents']) ? (data['dependents'] as Dependent[]) : [],
            employmentType: (data['employmentType'] as Employee['employmentType']) ?? null,
            department: String(data['department'] ?? ''),
            position: String(data['position'] ?? ''),
            status: (data['status'] as Employee['status']) ?? 'active',
            retiredDate: (data['retiredDate'] as Employee['retiredDate']) ?? null,
            createdAt: data['createdAt'] as Employee['createdAt'],
            updatedAt: data['updatedAt'] as Employee['updatedAt'],
        };
    }

    // Firestoreに従業員を登録
    async createEmployee(employeeInput: EmployeeInput): Promise<Employee> {
        const docRef = doc(collection(db, 'employees'));
        const createdAt = serverTimestamp() as Timestamp;
        const employee: Employee = {
            id: docRef.id,
            ...employeeInput,
            dependents: employeeInput.dependents ?? [],
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
            employees.push(this.toEmployee(docSnap.id, docSnap.data() as Record<string, unknown>));
        });

        return employees;
    }

    // employeeIdから従業員を取得
    async getEmployeeById(employeeId: string): Promise<Employee | null> {
        const docRef = doc(db, 'employees', employeeId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return this.toEmployee(employeeId, docSnap.data() as Record<string, unknown>);
    }

    async updateEmployee(employeeId: string, employeeInput: EmployeeInput): Promise<void> {
        const docRef = doc(db, 'employees', employeeId);
        await updateDoc(docRef, {
            ...employeeInput,
            dependents: employeeInput.dependents ?? [],
            updatedAt: serverTimestamp(),
        });
    }

}
