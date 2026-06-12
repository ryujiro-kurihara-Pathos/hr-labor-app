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
import { Dependent, DependentInput, Employee, EmployeeInput } from '../models/employee.models';

@Injectable({
    providedIn: 'root',
})

export class EmployeeService {

    private normalizeBuildingName(data: Record<string, unknown>): string {
        const buildingName = String(data['buildingName'] ?? '').trim();
        const roomNumber = String(data['roomNumber'] ?? '').trim();

        if (buildingName && roomNumber) {
            return `${buildingName} ${roomNumber}`;
        }

        return buildingName || roomNumber;
    }

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
            myNumber: String(data['myNumber'] ?? ''),
            gender: gender === 'female' ? 'female' : 'male',
            postalCode: String(data['postalCode'] ?? ''),
            prefecture: String(data['prefecture'] ?? ''),
            city: String(data['city'] ?? ''),
            streetAddress: String(data['streetAddress'] ?? data['address'] ?? ''),
            buildingName: this.normalizeBuildingName(data),
            phoneNumber: String(data['phoneNumber'] ?? ''),
            birthDate: String(data['birthDate'] ?? ''),
            joinedDate: String(data['joinedDate'] ?? ''),
            employmentType: (data['employmentType'] as Employee['employmentType']) ?? null,
            department: String(data['department'] ?? ''),
            position: String(data['position'] ?? ''),
            status: (data['status'] as Employee['status']) ?? 'active',
            retiredDate: (data['retiredDate'] as Employee['retiredDate']) ?? null,
            createdAt: data['createdAt'] as Employee['createdAt'],
            updatedAt: data['updatedAt'] as Employee['updatedAt'],
        };
    }

    /** 会社内の既存社員番号から次の8桁連番を採番する */
    async generateNextEmployeeNumber(companyId: string): Promise<string> {
        const employees = await this.getEmployeesByCompanyId(companyId);
        const used = new Set(
            employees.map((employee) => employee.employeeNumber.trim()).filter(Boolean),
        );

        let max = 0;
        for (const number of used) {
            if (!/^\d{1,8}$/.test(number)) continue;
            max = Math.max(max, Number(number));
        }

        for (let candidate = max + 1; candidate <= 99_999_999; candidate++) {
            const next = String(candidate).padStart(8, '0');
            if (!used.has(next)) return next;
        }

        return this.generateRandomEmployeeNumber(used);
    }

    private generateRandomEmployeeNumber(used: Set<string>): string {
        for (let attempt = 0; attempt < 100; attempt++) {
            const next = String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0');
            if (!used.has(next)) return next;
        }
        throw new Error('社員番号の生成に失敗しました');
    }

    // Firestoreに従業員を登録
    async createEmployee(employeeInput: EmployeeInput): Promise<Employee> {
        const employeeNumber = employeeInput.employeeNumber.trim()
            || await this.generateNextEmployeeNumber(employeeInput.companyId);

        const docRef = doc(collection(db, 'employees'));
        const createdAt = serverTimestamp() as Timestamp;
        const employee: Employee = {
            id: docRef.id,
            ...employeeInput,
            employeeNumber,
            createdAt: createdAt,
            updatedAt: createdAt,
        };
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
            updatedAt: serverTimestamp(),
        });
    }

    private toDependent(id: string, data: Record<string, unknown>): Dependent {
        const gender = data['gender'];
        const income = data['income'];

        return {
            id,
            lastName: String(data['lastName'] ?? ''),
            firstName: String(data['firstName'] ?? ''),
            birthDate: String(data['birthDate'] ?? ''),
            relationship: (data['relationship'] as Dependent['relationship']) ?? 'other',
            dependencyStartDate: String(data['dependencyStartDate'] ?? ''),
            dependencyEndDate: (data['dependencyEndDate'] as string | null) ?? null,
            status: (data['status'] as Dependent['status']) ?? 'active',
            memo: String(data['memo'] ?? ''),
            ...(gender === 'male' || gender === 'female' ? { gender } : {}),
            ...(data['myNumber'] ? { myNumber: String(data['myNumber']) } : {}),
            ...(data['address'] ? { address: String(data['address']) } : {}),
            ...(data['occupation'] ? { occupation: String(data['occupation']) } : {}),
            ...(typeof income === 'number' ? { income } : {}),
        };
    }

    private dependentToFirestore(input: DependentInput): Record<string, unknown> {
        const data: Record<string, unknown> = {
            lastName: input.lastName,
            firstName: input.firstName,
            birthDate: input.birthDate,
            relationship: input.relationship,
            dependencyStartDate: input.dependencyStartDate,
            dependencyEndDate: input.dependencyEndDate,
            status: input.status,
            memo: input.memo ?? '',
        };

        if (input.gender) data['gender'] = input.gender;
        if (input.myNumber) data['myNumber'] = input.myNumber;
        if (input.address) data['address'] = input.address;
        if (input.occupation) data['occupation'] = input.occupation;
        if (input.income != null) data['income'] = input.income;

        return data;
    }

    // employeeIdから扶養家族を取得
    async getDependentsByEmployeeId(employeeId: string): Promise<Dependent[]> {
        const docRef = collection(db, 'employees', employeeId, 'dependents');
        const snap = await getDocs(docRef);
        if (snap.empty) return [];

        const dependents: Dependent[] = [];
        snap.forEach((docSnap) => {
            dependents.push(this.toDependent(docSnap.id, docSnap.data() as Record<string, unknown>));
        });

        return dependents;
    }

    async createDependent(employeeId: string, input: DependentInput): Promise<Dependent> {
        const docRef = doc(collection(db, 'employees', employeeId, 'dependents'));
        const dependent: Dependent = {
            id: docRef.id,
            ...input,
            memo: input.memo ?? '',
        };

        await setDoc(docRef, this.dependentToFirestore(input));
        return dependent;
    }

    async updateDependent(
        employeeId: string,
        dependentId: string,
        input: Partial<DependentInput>,
    ): Promise<void> {
        const docRef = doc(db, 'employees', employeeId, 'dependents', dependentId);
        const updates: Record<string, unknown> = {};

        if (input.lastName !== undefined) updates['lastName'] = input.lastName;
        if (input.firstName !== undefined) updates['firstName'] = input.firstName;
        if (input.birthDate !== undefined) updates['birthDate'] = input.birthDate;
        if (input.relationship !== undefined) updates['relationship'] = input.relationship;
        if (input.dependencyStartDate !== undefined) updates['dependencyStartDate'] = input.dependencyStartDate;
        if (input.dependencyEndDate !== undefined) updates['dependencyEndDate'] = input.dependencyEndDate;
        if (input.status !== undefined) updates['status'] = input.status;
        if (input.memo !== undefined) updates['memo'] = input.memo;
        if (input.gender !== undefined) updates['gender'] = input.gender;
        if (input.myNumber !== undefined) updates['myNumber'] = input.myNumber;
        if (input.address !== undefined) updates['address'] = input.address;
        if (input.occupation !== undefined) updates['occupation'] = input.occupation;
        if (input.income !== undefined) updates['income'] = input.income;

        await updateDoc(docRef, updates);
    }

    async endDependent(
        employeeId: string,
        dependentId: string,
        dependencyEndDate: string,
        memo?: string,
    ): Promise<void> {
        await this.updateDependent(employeeId, dependentId, {
            status: 'ended',
            dependencyEndDate,
            ...(memo ? { memo } : {}),
        });
    }
}
