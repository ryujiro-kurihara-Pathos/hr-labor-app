import { Injectable, inject } from '@angular/core';



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

    deleteDoc,

} from 'firebase/firestore';



import {
    EMPTY_DEPENDENT_PROCEDURE_DATA,
    EMPTY_QUALIFICATION_PROCEDURE_DATA,
    DependentProcedureData,
    Procedure,
    ProcedureInput,
    QualificationProcedureData,
} from '../models/procedures.model';
import { hasSavedQualificationData } from '../utils/qualification-procedure-data.util';
import {
    canAutoManageQualificationProcedure,
    resolveEffectiveHealthInsuranceStartDateForSync,
    resolveQualificationProcedureDates,
    shouldSyncQualificationProcedureDates,
} from '../utils/qualification-procedure-data.util';
import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';
import { insuranceJoinStatus } from '../models/social-insurance-status.model';
import { dateStringFromTimestamp } from '../utils/insurance-premium-period.util';
import { resolveLossProcedureOccurredAndDueDate } from '../utils/procedure-due-date.util';
import { resolveLossDate, todayDateString } from '../utils/procedure-display.util';
import { SocialInsuranceStatusService } from './social-insurance-status.service';



@Injectable({

    providedIn: 'root',

})



export class SocialInsuranceProcedureService {
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly employeeService = inject(EmployeeService);

    private readonly collectionName = 'socialInsuranceProcedures';

    private readFlatQualificationProcedureData(data: Record<string, unknown>): QualificationProcedureData {
        return {
            officeSymbol: String(data['officeSymbol'] ?? ''),
            officeNumber: String(data['officeNumber'] ?? ''),
            companyName: String(data['companyName'] ?? ''),
            officeName: String(data['officeName'] ?? ''),
            officeAddress: String(data['officeAddress'] ?? ''),
            representativeName: String(data['representativeName'] ?? ''),
            phoneNumber: String(data['phoneNumber'] ?? ''),
            employeeLastName: String(data['employeeLastName'] ?? ''),
            employeeFirstName: String(data['employeeFirstName'] ?? ''),
            employeeLastNameKana: String(data['employeeLastNameKana'] ?? ''),
            employeeFirstNameKana: String(data['employeeFirstNameKana'] ?? ''),
            birthDate: String(data['birthDate'] ?? ''),
            myNumber: String(data['myNumber'] ?? ''),
            insuredPersonNumber: String(data['insuredPersonNumber'] ?? ''),
            employeeAddress: String(data['employeeAddress'] ?? ''),
            qualificationDate: String(data['qualificationDate'] ?? ''),
            rewardTargetYearMonth: (data['rewardTargetYearMonth'] as string | null) ?? null,
            rewardCashAmount: (data['rewardCashAmount'] as number | null) ?? null,
            rewardInKindAmount: (data['rewardInKindAmount'] as number | null) ?? null,
            rewardTotalAmount: (data['rewardTotalAmount'] as number | null) ?? null,
            rewardIsMidMonthJoin: Boolean(data['rewardIsMidMonthJoin']),
            hasDependents: Boolean(data['hasDependents']),
        };
    }
    private readQualificationProcedureData(data: Record<string, unknown>): QualificationProcedureData {
        const flat = this.readFlatQualificationProcedureData(data);
        const legacy = data['completedSnapshot'] as QualificationProcedureData | null | undefined;
        const flatProcedure = {
            ...EMPTY_QUALIFICATION_PROCEDURE_DATA,
            ...flat,
        } as Procedure;

        if (legacy && !hasSavedQualificationData(flatProcedure)) {
            return legacy;
        }

        return flat;
    }

    private readDependentProcedureData(data: Record<string, unknown>): DependentProcedureData {
        return {
            dependentId: (data['dependentId'] as string | null) ?? null,
            dependentLastName: String(data['dependentLastName'] ?? ''),
            dependentFirstName: String(data['dependentFirstName'] ?? ''),
            dependentBirthDate: String(data['dependentBirthDate'] ?? ''),
            dependentGender: String(data['dependentGender'] ?? ''),
            dependentRelationship: String(data['dependentRelationship'] ?? ''),
            dependentMyNumber: String(data['dependentMyNumber'] ?? ''),
            dependentAddress: String(data['dependentAddress'] ?? ''),
            dependentOccupation: String(data['dependentOccupation'] ?? ''),
            dependentIncome: (data['dependentIncome'] as number | null) ?? null,
            dependentIsDisabled: data['dependentIsDisabled'] === true,
            dependencyStartDate: String(data['dependencyStartDate'] ?? ''),
            dependentAddReason: (data['dependentAddReason'] as DependentProcedureData['dependentAddReason']) ?? '',
            dependentAddReasonNote: String(data['dependentAddReasonNote'] ?? ''),
            dependencyEndDate: String(data['dependencyEndDate'] ?? ''),
            dependentDeleteReason:
                (data['dependentDeleteReason'] as DependentProcedureData['dependentDeleteReason']) ?? '',
        };
    }

    private toProcedure(id: string, data: Record<string, unknown>): Procedure {

        return {

            id,

            companyId: String(data['companyId'] ?? ''),

            officeId: String(data['officeId'] ?? ''),

            employeeId: (data['employeeId'] as string | null) ?? null,

            procedureType: (data['procedureType'] as Procedure['procedureType']) ?? 'qualification',

            status: (data['status'] as Procedure['status']) ?? 'notStarted',

            occurredDate: String(data['occurredDate'] ?? ''),

            dueDate: String(data['dueDate'] ?? ''),

            completedDate: (data['completedDate'] as string | null) ?? null,

            submittedDate: (data['submittedDate'] as string | null) ?? null,

            targetYearMonth: (data['targetYearMonth'] as string | null) ?? null,

            memo: String(data['memo'] ?? ''),

            lossReason: (data['lossReason'] as Procedure['lossReason']) ?? null,

            dependentChanges: (data['dependentChanges'] as Procedure['dependentChanges']) ?? null,

            ...this.readQualificationProcedureData(data),

            ...this.readDependentProcedureData(data),

            createdAt: data['createdAt'] as Procedure['createdAt'],

            updatedAt: data['updatedAt'] as Procedure['updatedAt'],

        };

    }

    // Firestoreに手続きを登録
    async createProcedure(input: ProcedureInput): Promise<Procedure> {

        const docRef = doc(collection(db, this.collectionName));

        const createdAt = serverTimestamp() as Timestamp;

        const procedure: Procedure = {

            id: docRef.id,

            ...EMPTY_QUALIFICATION_PROCEDURE_DATA,

            ...EMPTY_DEPENDENT_PROCEDURE_DATA,

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

        return snapshot.docs.map((doc) => this.toProcedure(doc.id, doc.data() as Record<string, unknown>));

    }

    // 手続きを1件取得
    async getProcedureById(procedureId: string): Promise<Procedure | null> {

        const docRef = doc(db, this.collectionName, procedureId);

        const snapshot = await getDoc(docRef);



        if (!snapshot.exists()) return null;



        return this.toProcedure(procedureId, snapshot.data() as Record<string, unknown>);

    }

    async getOpenDependentChangeProcedureByEmployeeId(employeeId: string): Promise<Procedure | null> {

        const docRef = collection(db, this.collectionName);

        const q = query(

            docRef,

            where('employeeId', '==', employeeId),

            where('procedureType', '==', 'dependentChange'),

        );

        const snapshot = await getDocs(q);

        const open = snapshot.docs

            .map((item) => this.toProcedure(item.id, item.data() as Record<string, unknown>))

            .find((procedure) => procedure.status !== 'completed');



        return open ?? null;

    }

    async listQualificationProceduresByCompanyId(companyId: string): Promise<Procedure[]> {
        const docRef = collection(db, this.collectionName);
        const q = query(
            docRef,
            where('companyId', '==', companyId),
            where('procedureType', '==', 'qualification'),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) =>
            this.toProcedure(docSnap.id, docSnap.data() as Record<string, unknown>),
        );
    }

    // employeeIdから資格取得手続きを取得
    async getQualificationProcedureByEmployeeId(employeeId: string, companyId: string): Promise<Procedure | null> {

        const docRef = collection(db, this.collectionName);

        const q = query(docRef, where('employeeId', '==', employeeId), where('companyId', '==', companyId), where('procedureType', '==', 'qualification'));

        const snapshot = await getDocs(q);

        if(snapshot.empty) return null;



        return this.toProcedure(snapshot.docs[0].id, snapshot.docs[0].data() as Record<string, unknown>);

    }

    /** 入社日に合わせて資格取得届を自動作成、または未完了手続きの対象日を更新する */
    async syncQualificationProcedureForEmployee(params: {
        employee: Employee;
        healthInsuranceStartDate?: string | null;
        healthInsuranceStatus?: insuranceJoinStatus;
        pensionInsuranceStatus?: insuranceJoinStatus;
        /** 入社日変更時は変更前の入社日を渡す */
        previousJoinedDate?: string | null;
    }): Promise<Procedure | null> {
        const { employee } = params;
        const existing = await this.getQualificationProcedureByEmployeeId(
            employee.id,
            employee.companyId,
        );

        const followJoinDate = existing
            ? shouldSyncQualificationProcedureDates(existing.status, params.healthInsuranceStartDate ?? null, {
                previousJoinedDate: params.previousJoinedDate,
                newJoinedDate: employee.joinedDate,
                procedure: existing,
                employee,
            })
            : true;
        const effectiveHealthInsuranceStartDate = followJoinDate
            ? null
            : resolveEffectiveHealthInsuranceStartDateForSync(
                employee,
                params.healthInsuranceStartDate ?? null,
                params.previousJoinedDate ?? null,
                existing,
            );
        const dates = resolveQualificationProcedureDates(
            employee,
            effectiveHealthInsuranceStartDate,
        );
        if (!dates) return null;

        if (existing) {
            if (
                !shouldSyncQualificationProcedureDates(
                    existing.status,
                    params.healthInsuranceStartDate ?? null,
                    {
                        previousJoinedDate: params.previousJoinedDate,
                        newJoinedDate: employee.joinedDate,
                        procedure: existing,
                        employee,
                    },
                )
            ) {
                return existing;
            }

            const updated: Procedure = {
                ...existing,
                occurredDate: dates.occurredDate,
                dueDate: dates.dueDate,
                qualificationDate: dates.qualificationDate ?? '',
            };

            if (
                updated.occurredDate === existing.occurredDate
                && updated.dueDate === existing.dueDate
                && updated.qualificationDate === existing.qualificationDate
            ) {
                return existing;
            }

            await this.updateProcedure(updated);
            return updated;
        }

        if (
            !canAutoManageQualificationProcedure(
                params.healthInsuranceStatus,
                params.pensionInsuranceStatus,
            )
        ) {
            return null;
        }

        return this.createProcedure({
            companyId: employee.companyId,
            officeId: employee.officeId,
            employeeId: employee.id,
            procedureType: 'qualification',
            status: 'notStarted',
            occurredDate: dates.occurredDate,
            dueDate: dates.dueDate,
            completedDate: null,
            submittedDate: null,
            targetYearMonth: null,
            memo: '',
            lossReason: null,
            dependentChanges: null,
            qualificationDate: dates.qualificationDate ?? '',
        });
    }

    /** 退職日に合わせて資格喪失届を自動作成、または未完了手続きの対象日を更新する */
    async syncLossProcedureForEmployee(employee: Employee): Promise<Procedure | null> {
        const retirementDate = dateStringFromTimestamp(employee.retiredDate);
        if (!retirementDate) return null;

        const existing = await this.getLossProcedureByEmployeeId(
            employee.id,
            employee.companyId,
        );

        const { occurredDate, dueDate } = resolveLossProcedureOccurredAndDueDate({
            retirementDate,
            lossReason: 'retirement',
        });
        if (!occurredDate) return existing;

        if (existing) {
            if (existing.status === 'completed') {
                return existing;
            }

            const updated: Procedure = {
                ...existing,
                occurredDate,
                dueDate,
                lossReason: existing.lossReason ?? 'retirement',
            };

            if (
                updated.occurredDate === existing.occurredDate
                && updated.dueDate === existing.dueDate
                && updated.lossReason === existing.lossReason
            ) {
                return existing;
            }

            await this.updateProcedure(updated);
            return updated;
        }

        return this.createProcedure({
            companyId: employee.companyId,
            officeId: employee.officeId,
            employeeId: employee.id,
            procedureType: 'loss',
            status: 'notStarted',
            occurredDate,
            dueDate,
            completedDate: null,
            submittedDate: null,
            targetYearMonth: null,
            memo: '',
            lossReason: 'retirement',
            dependentChanges: null,
        });
    }

    // employeeIdから資格喪失手続きを取得
    async getLossProcedureByEmployeeId(employeeId: string, companyId: string): Promise<Procedure | null> {
        const docRef = collection(db, this.collectionName);
        const q = query(
            docRef,
            where('employeeId', '==', employeeId),
            where('companyId', '==', companyId),
            where('procedureType', '==', 'loss'),
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        return this.toProcedure(snapshot.docs[0].id, snapshot.docs[0].data() as Record<string, unknown>);
    }

    // employeeIdと対象年月から算定基礎届を取得
    async getRegularDecisionProcedureByEmployeeIdAndTargetYearMonth(
        employeeId: string,
        companyId: string,
        targetYearMonth: string,
    ): Promise<Procedure | null> {
        const docRef = collection(db, this.collectionName);
        const q = query(
            docRef,
            where('employeeId', '==', employeeId),
            where('companyId', '==', companyId),
            where('procedureType', '==', 'regularDecision'),
            where('targetYearMonth', '==', targetYearMonth),
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        return this.toProcedure(snapshot.docs[0].id, snapshot.docs[0].data() as Record<string, unknown>);
    }

    // employeeIdと改定年月（適用開始月）から月額変更届を取得
    async getRevisionProcedureByEmployeeIdAndTargetYearMonth(
        employeeId: string,
        companyId: string,
        targetYearMonth: string,
    ): Promise<Procedure | null> {
        const docRef = collection(db, this.collectionName);
        const q = query(
            docRef,
            where('employeeId', '==', employeeId),
            where('companyId', '==', companyId),
            where('procedureType', '==', 'revision'),
            where('targetYearMonth', '==', targetYearMonth),
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        return this.toProcedure(snapshot.docs[0].id, snapshot.docs[0].data() as Record<string, unknown>);
    }

    // employeeIdと対象年月から賞与支払届を取得
    async getBonusPaymentProcedureByEmployeeIdAndTargetYearMonth(
        employeeId: string,
        companyId: string,
        targetYearMonth: string,
    ): Promise<Procedure | null> {
        const docRef = collection(db, this.collectionName);
        const q = query(
            docRef,
            where('employeeId', '==', employeeId),
            where('companyId', '==', companyId),
            where('procedureType', '==', 'bonusPayment'),
            where('targetYearMonth', '==', targetYearMonth),
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        return this.toProcedure(snapshot.docs[0].id, snapshot.docs[0].data() as Record<string, unknown>);
    }

    /** 未提出の手続きを削除 */
    async deleteProcedure(procedureId: string): Promise<void> {
        const existing = await this.getProcedureById(procedureId);
        if (!existing) {
            throw new Error('手続きが見つかりませんでした');
        }
        if (existing.status === 'completed') {
            throw new Error('提出済みの手続きは削除できません');
        }

        const docRef = doc(db, this.collectionName, procedureId);
        await deleteDoc(docRef);
    }

    // 手続きを更新
    async updateProcedure(procedure: Procedure): Promise<void> {

        const docRef = doc(db, this.collectionName, procedure.id);

        await updateDoc(docRef, {

            status: procedure.status,

            occurredDate: procedure.occurredDate,

            dueDate: procedure.dueDate,

            completedDate: procedure.completedDate,

            submittedDate: procedure.submittedDate,

            targetYearMonth: procedure.targetYearMonth,

            memo: procedure.memo,

            lossReason: procedure.lossReason,

            dependentChanges: procedure.dependentChanges,

            ...this.readQualificationProcedureData(procedure as unknown as Record<string, unknown>),

            ...this.readDependentProcedureData(procedure as unknown as Record<string, unknown>),

            updatedAt: serverTimestamp(),

        });

    }

    async markProcedureAsSubmitted(procedure: Procedure): Promise<Procedure> {
        const submittedDate = todayDateString();
        const updated: Procedure = {
            ...procedure,
            status: 'completed',
            completedDate: procedure.completedDate ?? submittedDate,
            submittedDate,
        };

        await this.updateProcedure(updated);

        if (procedure.procedureType === 'loss' && procedure.employeeId) {
            const status = await this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(
                procedure.employeeId,
            );
            const employee = procedure.employeeId
                ? await this.employeeService.getEmployeeById(procedure.employeeId)
                : null;
            const lossDate = resolveLossDate(
                status?.healthInsuranceEndDate,
                status?.pensionInsuranceEndDate,
                procedure.occurredDate,
                {
                    lossReason: procedure.lossReason,
                    retiredDate: dateStringFromTimestamp(employee?.retiredDate ?? null),
                },
            );
            if (lossDate) {
                await this.socialInsuranceStatusService.syncLossDates(procedure.employeeId, lossDate);
            }
        }

        return updated;
    }

    // 資格取得届を完了し、表示データを procedures に直接保存する
    async completeQualificationProcedure(
        procedureId: string,
        procedureData: QualificationProcedureData,
        completedDate: string,
        employeeId: string,
    ): Promise<string> {
        const insuredPersonNumber = await this.employeeService.assignInsuredPersonNumberIfMissing(employeeId);
        const docRef = doc(db, this.collectionName, procedureId);

        await updateDoc(docRef, {
            status: 'completed',
            completedDate,
            submittedDate: completedDate,
            ...procedureData,
            insuredPersonNumber,
            updatedAt: serverTimestamp(),
        });

        const qualificationDate = procedureData.qualificationDate?.trim();
        if (qualificationDate) {
            await this.socialInsuranceStatusService.syncQualificationCompletion(
                employeeId,
                qualificationDate,
            );
        }

        return insuredPersonNumber;
    }
}