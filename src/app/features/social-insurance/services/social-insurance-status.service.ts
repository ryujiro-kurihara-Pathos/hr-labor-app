import { inject, Injectable } from '@angular/core';

import {
    doc,
    setDoc,
    getDocs,
    updateDoc,
    query,
    where,
    collection,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';

import { EmployeeService } from '../../employee/services/employee.service';
import { SocialInsuranceStatus, SocialInsuranceStatusInput } from '../models/social-insurance-status.model';
import {
    computeCareInsurancePeriod,
    currentYearMonth,
    judgeCareInsuranceStatus,
} from '../utils/care-insurance-period.util';

@Injectable({
    providedIn: 'root',
})

export class SocialInsuranceStatusService {
    private readonly employeeService = inject(EmployeeService);

    private normalizeStatus(id: string, data: Record<string, unknown>): SocialInsuranceStatus {
        return {
            id,
            employeeId: String(data['employeeId'] ?? ''),
            weeklyScheduledWorkHours: this.toNullableNumber(data['weeklyScheduledWorkHours']),
            monthlyScheduledWorkDays: this.toNullableNumber(data['monthlyScheduledWorkDays']),
            prescribedWage: this.toNullableNumber(data['prescribedWage']),
            isStudent: Boolean(data['isStudent']),
            expectedEmploymentOver2Months: Boolean(data['expectedEmploymentOver2Months']),
            healthInsuranceStatus: (data['healthInsuranceStatus'] as SocialInsuranceStatus['healthInsuranceStatus']) ?? 'unknown',
            pensionInsuranceStatus: (data['pensionInsuranceStatus'] as SocialInsuranceStatus['pensionInsuranceStatus']) ?? 'unknown',
            careInsuranceStatus: (data['careInsuranceStatus'] as SocialInsuranceStatus['careInsuranceStatus']) ?? 'unknown',
            healthInsuranceStartDate: (data['healthInsuranceStartDate'] as string | null) ?? null,
            healthInsuranceEndDate: (data['healthInsuranceEndDate'] as string | null) ?? null,
            pensionInsuranceStartDate: (data['pensionInsuranceStartDate'] as string | null) ?? null,
            pensionInsuranceEndDate: (data['pensionInsuranceEndDate'] as string | null) ?? null,
            careInsuranceStartDate: (data['careInsuranceStartDate'] as string | null) ?? null,
            careInsuranceEndDate: (data['careInsuranceEndDate'] as string | null) ?? null,
            memo: String(data['memo'] ?? ''),
            createdAt: data['createdAt'] as SocialInsuranceStatus['createdAt'],
            updatedAt: data['updatedAt'] as SocialInsuranceStatus['updatedAt'],
        };
    }

    private toNullableNumber(value: unknown): number | null {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    // Firestoreに社会保険情報を登録
    async createSocialInsuranceStatus(
        statusInput: SocialInsuranceStatusInput,
    ): Promise<SocialInsuranceStatus> {
        const docRef = doc(collection(db, 'socialInsuranceStatuses'));

        const socialInsuranceStatus: SocialInsuranceStatus = {
            id: docRef.id,
            ...statusInput,
            memo: statusInput.memo ?? '',
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
        };
        await setDoc(docRef, socialInsuranceStatus);
        return socialInsuranceStatus;
    }

    // employeeIdから社会保険情報を取得
    async getInsuranceStatusByEmployeeId(employeeId: string): Promise<SocialInsuranceStatus | null> {
        const docRef = collection(db, 'socialInsuranceStatuses');
        const q = query(docRef, where('employeeId', '==', employeeId));
        const docSnap = await getDocs(q);
        if (docSnap.empty) return null;

        const snapshot = docSnap.docs[0];
        return this.normalizeStatus(snapshot.id, snapshot.data() as Record<string, unknown>);
    }

    async listByEmployeeIds(employeeIds: string[]): Promise<SocialInsuranceStatus[]> {
        if (employeeIds.length === 0) return [];

        const statuses = await Promise.all(
            employeeIds.map((employeeId) => this.getInsuranceStatusByEmployeeId(employeeId)),
        );
        return statuses.filter((status): status is SocialInsuranceStatus => status !== null);
    }

    // 社会保険情報を更新
    async updateSocialInsuranceStatus(id: string, socialInsuranceStatusInput: SocialInsuranceStatusInput): Promise<void> {
        const docRef = doc(db, 'socialInsuranceStatuses', id);
        await updateDoc(docRef, {
            ...socialInsuranceStatusInput,
            memo: socialInsuranceStatusInput.memo ?? '',
            updatedAt: serverTimestamp(),
        });
    }

    private toStatusInput(status: SocialInsuranceStatus): SocialInsuranceStatusInput {
        return {
            employeeId: status.employeeId,
            weeklyScheduledWorkHours: status.weeklyScheduledWorkHours,
            monthlyScheduledWorkDays: status.monthlyScheduledWorkDays,
            prescribedWage: status.prescribedWage,
            isStudent: status.isStudent,
            expectedEmploymentOver2Months: status.expectedEmploymentOver2Months,
            healthInsuranceStatus: status.healthInsuranceStatus,
            pensionInsuranceStatus: status.pensionInsuranceStatus,
            careInsuranceStatus: status.careInsuranceStatus,
            healthInsuranceStartDate: status.healthInsuranceStartDate,
            healthInsuranceEndDate: status.healthInsuranceEndDate,
            pensionInsuranceStartDate: status.pensionInsuranceStartDate,
            pensionInsuranceEndDate: status.pensionInsuranceEndDate,
            careInsuranceStartDate: status.careInsuranceStartDate,
            careInsuranceEndDate: status.careInsuranceEndDate,
            memo: status.memo ?? '',
        };
    }

    async syncQualificationDates(employeeId: string, qualificationDate: string): Promise<void> {
        await this.syncQualificationCompletion(employeeId, qualificationDate);
    }

    async syncQualificationCompletion(employeeId: string, qualificationDate: string): Promise<void> {
        const date = qualificationDate.trim();
        if (!date) return;

        const status = await this.getInsuranceStatusByEmployeeId(employeeId);
        if (!status) return;

        const nextInput: SocialInsuranceStatusInput = {
            ...this.toStatusInput(status),
            healthInsuranceStatus: 'active',
            pensionInsuranceStatus: 'active',
            healthInsuranceStartDate: date,
            pensionInsuranceStartDate: date,
        };

        await this.updateSocialInsuranceStatus(
            status.id,
            await this.withSyncedCareInsuranceDates(employeeId, nextInput),
        );
    }

    async syncLossDates(employeeId: string, lossDate: string): Promise<void> {
        const date = lossDate.trim();
        if (!date) return;

        const status = await this.getInsuranceStatusByEmployeeId(employeeId);
        if (!status) return;

        const nextInput: SocialInsuranceStatusInput = {
            ...this.toStatusInput(status),
            healthInsuranceEndDate: date,
            pensionInsuranceEndDate: date,
        };

        await this.updateSocialInsuranceStatus(
            status.id,
            await this.withSyncedCareInsuranceDates(employeeId, nextInput),
        );
    }

    async clearLossDates(employeeId: string): Promise<void> {
        const status = await this.getInsuranceStatusByEmployeeId(employeeId);
        if (!status) return;
        if (!status.healthInsuranceEndDate && !status.pensionInsuranceEndDate) return;

        const nextInput: SocialInsuranceStatusInput = {
            ...this.toStatusInput(status),
            healthInsuranceEndDate: null,
            pensionInsuranceEndDate: null,
        };

        await this.updateSocialInsuranceStatus(
            status.id,
            await this.withSyncedCareInsuranceDates(employeeId, nextInput),
        );
    }

    async withSyncedCareInsuranceDates(
        employeeId: string,
        input: SocialInsuranceStatusInput,
    ): Promise<SocialInsuranceStatusInput> {
        const employee = await this.employeeService.getEmployeeById(employeeId);
        if (!employee) return input;

        const period = computeCareInsurancePeriod(
            input.healthInsuranceStartDate,
            input.healthInsuranceEndDate,
            employee.birthDate,
        );

        return {
            ...input,
            careInsuranceStartDate: period.startDate,
            careInsuranceEndDate: period.endDate,
            careInsuranceStatus: judgeCareInsuranceStatus(
                currentYearMonth(),
                input.healthInsuranceStartDate,
                input.healthInsuranceEndDate,
                employee.birthDate,
            ),
        };
    }

    // 社会保険情報を取得
    async getHealthInsuranceStatus(employeeId: string): Promise<SocialInsuranceStatus | null> {
        return this.getInsuranceStatusByEmployeeId(employeeId);
    }
}
