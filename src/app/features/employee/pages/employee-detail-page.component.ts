import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { Timestamp } from 'firebase/firestore';

import { EmployeeService } from '../services/employee.service';
import { OfficeService } from '../../company/services/office.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { SocialInsuranceProcedureService } from '../../social-insurance/services/social-insurance-procedure.service';

import { Office } from '../../company/models/office.model';
import { Dependent, Employee, EmployeeInput, EmploymentType, toEmployeeInput } from '../models/employee.models';
import { insuranceJoinStatus, SocialInsuranceStatus, SocialInsuranceStatusInput } from '../../social-insurance/models/social-insurance-status.model';
import { formatInsuranceDate } from '../../social-insurance/utils/social-insurance-status-display.util';
import { Procedure, ProcedureStatus } from '../../social-insurance/models/procedures.model';
import {
    resolvePreviewQualificationDate,
    resolveQualificationDateAfterJoinDateChange,
} from '../../social-insurance/utils/qualification-procedure-data.util';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { PostalCodeLookupService } from '../../../shared/services/postal-code-lookup.service';
import { applyPostalLookupResult } from '../../../shared/utils/postal-code-lookup.util';
import { PartTimeInsuranceWarningComponent } from '../../social-insurance/components/part-time-insurance-warning.component';
import {
    parseJudgmentNumber,
    PartTimeInsuranceJudgmentInput,
} from '../../social-insurance/utils/part-time-insurance-judgment.util';
import {
    computeCareInsurancePeriod,
    currentYearMonth,
    judgeCareInsuranceStatus,
} from '../../social-insurance/utils/care-insurance-period.util';
import {
    computeInsurancePremiumPeriod,
    lossDateFromRetirementDate,
} from '../../social-insurance/utils/insurance-premium-period.util';
import {
    judgeHealthInsuranceJoinStatus,
    judgePensionInsuranceJoinStatus,
} from '../../social-insurance/utils/age-premium-period.util';
import { formatYearMonthLabel } from '../../insurance/utils/standard-remuneration-determination.util';
import { EmployeeInvitePanelComponent } from '../../invitations/components/employee-invite-panel.component';
import {
    employeeDisplayStatusLabel,
    isEmployeeBeforeJoin,
    isEmployeeActive,
    isEmployeeFullyRetired,
    isEmployeePendingRetirement,
    resolveEmployeeDisplayStatus,
    resolveEmployeeStoredStatus,
    retiredDateFromInput,
} from '../utils/employee-status-display.util';
import { dependentRelationshipLabel } from '../../social-insurance/utils/dependent-procedure-data.util';
import {
    compareProceduresForList,
    isProcedureOverdue,
    procedureStatusLabel,
    procedureTypeMeta,
    todayDateString,
} from '../../social-insurance/utils/procedure-display.util';

type SocialInsuranceDraft = {
    weeklyScheduledWorkHours: string | number;
    monthlyScheduledWorkDays: string | number;
    prescribedWage: string | number;
    isStudent: boolean;
    expectedEmploymentOver2Months: boolean;
};

type InsuranceDateDisplay = {
    main: string;
    monthNote: string | null;
};

@Component({
    selector: 'app-employee-detail-page',
    standalone: true,
    imports: [FormsModule, RouterLink, DecimalPipe, PartTimeInsuranceWarningComponent, EmployeeInvitePanelComponent],
    templateUrl: './employee-detail-page.component.html',
})

export class EmployeeDetailPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly insuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly confirmService = inject(ConfirmService);
    private readonly postalCodeLookupService = inject(PostalCodeLookupService);

    // 従業員情報
    employee = signal<Employee | null>(null);
    office = signal<Office | null>(null);
    officeName = signal<string>('');
    
    // 取得資格手続きのID
    qualificationProcedure = signal<Procedure | null>(null);
    employeeProcedures = signal<Procedure[]>([]);

    readonly procedureTypeMeta = procedureTypeMeta;
    readonly procedureStatusLabel = procedureStatusLabel;

    // ローディング
    isLoading = signal<boolean>(false);
    isSaving = signal<boolean>(false);
    isRetiring = signal<boolean>(false);
    isEditing = signal<boolean>(false);
    isRetireFormOpen = signal<boolean>(false);
    isCreatingQualificationProcedure = signal<boolean>(false);
    isPostalLookupLoading = signal(false);
    postalLookupError = signal('');
    inviteMessage = signal('');
    errorMessage = signal<string>('');
    age = computed(() => {
        const employee = this.employee();
        return employee ? this.ageToday(employee.birthDate) : null;
    });

    employeeProceduresSorted = computed(() => {
        const today = todayDateString();
        return [...this.employeeProcedures()].sort((a, b) => compareProceduresForList(a, b, today));
    });

    pendingProcedureCount = computed(
        () => this.employeeProceduresSorted().filter((procedure) => procedure.status !== 'completed').length,
    );

    activeDependentCount = computed(
        () => this.dependents().filter((dependent) => dependent.status === 'active').length,
    );

    /** 編集中はフォームの生年月日、閲覧時は保存済みの生年月日 */
    birthDateForInsuranceJudgment(): string | null {
        if (this.isEditing()) {
            return this.birthDate || null;
        }
        return this.employee()?.birthDate ?? null;
    }

    careInsurancePeriodForDisplay() {
        return computeCareInsurancePeriod(
            this.emptyToNullDate(this.healthInsuranceStartDate),
            this.emptyToNullDate(this.healthInsuranceEndDate),
            this.birthDateForInsuranceJudgment(),
        );
    }

    healthInsuranceJoinStatus(): insuranceJoinStatus {
        return judgeHealthInsuranceJoinStatus(
            this.judgeSocialInsuranceEmployment(),
            this.birthDateForInsuranceJudgment(),
        );
    }

    pensionInsuranceJoinStatus(): insuranceJoinStatus {
        return judgePensionInsuranceJoinStatus(
            this.judgeSocialInsuranceEmployment(),
            this.birthDateForInsuranceJudgment(),
        );
    }

    careInsuranceJoinStatus(): insuranceJoinStatus {
        return judgeCareInsuranceStatus(
            currentYearMonth(),
            this.emptyToNullDate(this.healthInsuranceStartDate),
            this.emptyToNullDate(this.healthInsuranceEndDate),
            this.birthDateForInsuranceJudgment(),
        );
    }

    partTimeJudgmentInput = computed((): PartTimeInsuranceJudgmentInput => ({
        weeklyScheduledWorkHours: parseJudgmentNumber(this.weeklyScheduledWorkHours),
        monthlyScheduledWorkDays: parseJudgmentNumber(this.monthlyScheduledWorkDays),
        prescribedWage: parseJudgmentNumber(this.prescribedWage),
    }));

    healthPensionPremiumPeriod = computed(() =>
        computeInsurancePremiumPeriod(
            this.emptyToNullDate(this.healthInsuranceStartDate),
            this.emptyToNullDate(this.healthInsuranceEndDate),
        ),
    );

    retiredDateInput = '';

    lastName = '';
    firstName = '';
    lastNameKana = '';
    firstNameKana = '';
    myNumber = '';
    gender: Employee['gender'] = 'male';
    postalCode = '';
    prefecture = '';
    city = '';
    streetAddress = '';
    buildingName = '';
    phoneNumber = '';
    email = '';
    employeeNumber = '';
    birthDate = '';
    joinedDate = '';
    department = '';
    position = '';
    employmentType: EmploymentType = null;

    // 社会保険 加入要件
    weeklyScheduledWorkHours: string | number = ''; // number入力だが空を許容するため文字列
    monthlyScheduledWorkDays: string | number = '';
    prescribedWage: string | number = '';
    isStudent = false;
    expectedEmploymentOver2Months = false;

    healthInsuranceStartDate = '';
    healthInsuranceEndDate = '';
    pensionInsuranceStartDate = '';
    pensionInsuranceEndDate = '';
    careInsuranceStartDate = '';
    careInsuranceEndDate = '';
    insuranceMemo = '';

    private socialInsuranceSnapshot: SocialInsuranceDraft = this.createEmptySocialInsuranceDraft();

    // 社会保険情報
    socialInsuranceStatus = signal<SocialInsuranceStatus | null>(null);

    // 初期処理
    async ngOnInit() {
        const employeeId = this.route.snapshot.params['employeeId'];

        if (!employeeId) {
            this.errorMessage.set('従業員が見つかりませんでした');
            return;
        }

        const inviteMsg = this.route.snapshot.queryParamMap.get('inviteMsg');
        if (inviteMsg) {
            this.inviteMessage.set(inviteMsg);
            void this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { inviteMsg: null },
                queryParamsHandling: 'merge',
                replaceUrl: true,
            });
        }

        await this.loadEmployee(employeeId);
        await this.loadDependents();
        this.scrollToRouteFragment();
        if (inviteMsg) {
            queueMicrotask(() => {
                document.getElementById('user-invite')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }

    private scrollToRouteFragment(): void {
        const fragment = this.route.snapshot.fragment;
        if (!fragment) return;

        queueMicrotask(() => {
            document.getElementById(fragment)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // 従業員情報の読み込み
    async loadEmployee(employeeId: string): Promise<void> {
        this.isLoading.set(true);
        this.errorMessage.set('');
        this.employee.set(null);
        this.office.set(null);
        this.officeName.set('');

        try {
            // 従業員を取得
            const employee = await this.employeeService.getEmployeeById(employeeId);
            this.employee.set(employee);

            if (!employee) {
                this.errorMessage.set('従業員が見つかりませんでした');
                return;
            }

            // 事業所を取得
            const office = await this.officeService.getOfficeById(employee.officeId);
            this.office.set(office);
            this.officeName.set(office?.name ?? employee.officeId);
            this.syncFormFromEmployee(employee);

            // 社会保険情報を取得
            const socialInsuranceStatus = await this.insuranceStatusService.getInsuranceStatusByEmployeeId(employeeId);
            this.socialInsuranceStatus.set(socialInsuranceStatus);
            this.syncFormFromSocialInsuranceStatus(socialInsuranceStatus);

            await this.loadQualificationProcedure();
            await this.loadLossProcedure();
            await this.loadOpenDependentChangeProcedure();
            await this.loadEmployeeProcedures();
        } catch (error) {
            console.error('従業員の取得に失敗しました', error);
            this.errorMessage.set('従業員の取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    // 資格取得手続きの読み込み
    async loadQualificationProcedure(): Promise<void> {
        this.qualificationProcedure.set(null);

        const employee = this.employee();
        if(!employee) return;

        try {
            const procedure = await this.procedureService.getQualificationProcedureByEmployeeId(employee.id, employee.companyId);
            this.qualificationProcedure.set(procedure);
        } catch (error) {
            console.error('資格取得手続きの取得に失敗しました', error);
            this.errorMessage.set('資格取得手続きの取得に失敗しました');
            this.isLoading.set(false);
        }
    }

    // 資格取得手続きの存在判定
    qualificationProcedureExists = computed((): boolean => {
        const procedure = this.qualificationProcedure();
        return procedure !== null;
    })

    // 資格取得手続きの進捗
    qualificationProcedureStatus = computed((): ProcedureStatus => {
        const status = this.qualificationProcedure()?.status;
        if(!status) return 'notStarted';
        return status;
    });

    // 健康保険の対象だが資格取得手続きが未完了
    needsQualificationProcedurePrompt = computed((): boolean => {
        if (!this.isHealthInsuranceEligible()) return false;

        const procedure = this.qualificationProcedure();
        return procedure === null || procedure.status !== 'completed';
    });

    // 扶養家族
    dependents = signal<Dependent[]>([]);
    selectedDependentId = signal<string | null>(null);

    sortedDependents = computed(() => {
        const list = [...this.dependents()];
        return list.sort((a, b) => {
            if (a.status !== b.status) {
                return a.status === 'active' ? -1 : 1;
            }
            return b.dependencyStartDate.localeCompare(a.dependencyStartDate);
        });
    });

    selectedDependent = computed(() => {
        const id = this.selectedDependentId();
        if (!id) return null;
        return this.dependents().find((dependent) => dependent.id === id) ?? null;
    });

    readonly dependentRelationshipLabel = dependentRelationshipLabel;

    // 扶養家族の取得
    async loadDependents(): Promise<void> {
        this.dependents.set([]);

        const employee = this.employee();
        if(!employee) return;

        try {
            const dependents = await this.employeeService.getDependentsByEmployeeId(employee.id);
            this.dependents.set(dependents);
            this.selectedDependentId.set(null);
        } catch (error) {
            console.error('扶養家族の取得に失敗しました', error);
            this.errorMessage.set('扶養家族の取得に失敗しました');
        }
    }

    async loadEmployeeProcedures(): Promise<void> {
        this.employeeProcedures.set([]);

        const employee = this.employee();
        if (!employee) return;

        try {
            const procedures = await this.procedureService.getProcedures();
            const today = todayDateString();
            const list = procedures
                .filter(
                    (procedure) =>
                        procedure.companyId === employee.companyId && procedure.employeeId === employee.id,
                )
                .sort((a, b) => compareProceduresForList(a, b, today));
            this.employeeProcedures.set(list);
        } catch (error) {
            console.error('手続きの取得に失敗しました', error);
        }
    }

    isHealthInsuranceEligible(): boolean {
        if (this.isEditing()) {
            return (
                this.healthInsuranceJoinStatus() === 'active' &&
                this.pensionInsuranceJoinStatus() === 'active'
            );
        }

        const status = this.socialInsuranceStatus();
        if (!status) return false;

        if (status.healthInsuranceStatus === 'active' && status.pensionInsuranceStatus === 'active') {
            return true;
        }
        if (status.healthInsuranceStatus === 'inactive' || status.pensionInsuranceStatus === 'inactive') {
            return false;
        }

        return (
            this.healthInsuranceJoinStatus() === 'active' &&
            this.pensionInsuranceJoinStatus() === 'active'
        );
    }

    qualificationProcedureStatusLabel(status: ProcedureStatus): string {
        const labels: Record<ProcedureStatus, string> = {
            notStarted: '未対応',
            inProgress: '対応中',
            completed: '完了',
        };
        return labels[status];
    }

    // 資格取得手続きの追加
    async openQualificationProcedure(): Promise<void> {
        const employee = this.employee();
        if (!employee || !this.isHealthInsuranceEligible()) return;

        const existing = this.qualificationProcedure();
        if (existing) {
            this.router.navigate(['/procedures', existing.id]);
            return;
        }

        this.isCreatingQualificationProcedure.set(true);
        this.errorMessage.set('');

        try {
            const status = this.socialInsuranceStatus();
            const procedure = await this.procedureService.syncQualificationProcedureForEmployee({
                employee,
                healthInsuranceStartDate: status?.healthInsuranceStartDate ?? null,
                healthInsuranceStatus: status?.healthInsuranceStatus,
                pensionInsuranceStatus: status?.pensionInsuranceStatus,
            });
            if (!procedure) {
                this.errorMessage.set('資格取得手続きを作成できませんでした');
                return;
            }
            this.qualificationProcedure.set(procedure);
            this.router.navigate(['/procedures', procedure.id]);
        } catch (error) {
            console.error('資格取得手続きの作成に失敗しました', error);
            this.errorMessage.set('資格取得手続きの作成に失敗しました');
        } finally {
            this.isCreatingQualificationProcedure.set(false);
        }
    }

    // 扶養変更手続き
    openDependentChangeProcedure = signal<Procedure | null>(null);

    // 扶養変更手続きの取得
    async loadOpenDependentChangeProcedure(): Promise<void> {
        this.openDependentChangeProcedure.set(null);

        const employee = this.employee();
        if (!employee) return;

        try {
            const procedure = await this.procedureService.getOpenDependentChangeProcedureByEmployeeId(employee.id);
            this.openDependentChangeProcedure.set(procedure);
        } catch (error) {
            console.error('扶養変更手続きの取得に失敗しました', error);
            this.errorMessage.set('扶養変更手続きの取得に失敗しました');
        }
    }

    // 扶養変更手続きの追加
    async createDependentProcedure(): Promise<void> {
        const employee = this.employee();
        if (!employee) return;

        const existing = this.openDependentChangeProcedure();
        if (existing) {
            this.router.navigate(['/procedures', existing.id]);
            return;
        }

        try {
            const procedure = await this.procedureService.createProcedure({
                companyId: employee.companyId,
                officeId: employee.officeId,
                employeeId: employee.id,
                procedureType: 'dependentChange',
                status: 'notStarted',
                occurredDate: '',
                dueDate: '',
                completedDate: null,
                submittedDate: null,
                targetYearMonth: null,
                memo: '',
                lossReason: null,
                dependentChanges: null,
            });
            if (!procedure) return;
            this.openDependentChangeProcedure.set(procedure);
            this.router.navigate(['/procedures', procedure.id]);
        } catch (error) {
            console.error('扶養家族手続きの追加に失敗しました', error);
            this.errorMessage.set('扶養家族手続きの追加に失敗しました');
        }
    }

    // 資格喪失届
    lossProcedure = signal<Procedure | null>(null);
    isCreatingLossProcedure = signal<boolean>(false);

    async loadLossProcedure(): Promise<void> {
        this.lossProcedure.set(null);

        const employee = this.employee();
        if (!employee) return;

        try {
            const procedure = await this.procedureService.getLossProcedureByEmployeeId(
                employee.id,
                employee.companyId,
            );
            this.lossProcedure.set(procedure);
        } catch (error) {
            console.error('資格喪失手続きの取得に失敗しました', error);
            this.errorMessage.set('資格喪失手続きの取得に失敗しました');
        }
    }

    lossProcedureExists = computed((): boolean => this.lossProcedure() !== null);

    lossProcedureStatus = computed((): ProcedureStatus => {
        const status = this.lossProcedure()?.status;
        if (!status) return 'notStarted';
        return status;
    });

    hasRetiredDate = computed((): boolean => Boolean(this.employee()?.retiredDate));

    needsLossProcedurePrompt = computed((): boolean => {
        if (!this.hasRetiredDate()) return false;

        const procedure = this.lossProcedure();
        return procedure === null || procedure.status !== 'completed';
    });

    // 退職日を過ぎたかどうかの判定
    isPastRetiredDate(): boolean {
        const employee = this.employee();
        if (!employee?.retiredDate) return false;

        const retiredDate = employee.retiredDate.toDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        retiredDate.setHours(0, 0, 0, 0);
        return retiredDate < today;
    }

    async openLossProcedure(): Promise<void> {
        const employee = this.employee();
        if (!employee?.retiredDate) return;

        const existing = this.lossProcedure();
        if (existing) {
            this.router.navigate(['/procedures', existing.id]);
            return;
        }

        this.isCreatingLossProcedure.set(true);
        this.errorMessage.set('');

        try {
            const procedure = await this.procedureService.syncLossProcedureForEmployee(employee);
            if (!procedure) {
                this.errorMessage.set('資格喪失手続きの作成に失敗しました');
                return;
            }
            this.lossProcedure.set(procedure);
            this.router.navigate(['/procedures', procedure.id]);
        } catch (error) {
            console.error('資格喪失手続きの作成に失敗しました', error);
            this.errorMessage.set('資格喪失手続きの作成に失敗しました');
        } finally {
            this.isCreatingLossProcedure.set(false);
        }
    }

    private retiredDateString(retiredDate: Timestamp): string {
        const date = retiredDate.toDate();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    startEdit(): void {
        const employee = this.employee();
        if (!employee) return;

        this.syncFormFromEmployee(employee);
        this.socialInsuranceSnapshot = this.captureSocialInsuranceDraft();
        this.errorMessage.set('');
        this.postalLookupError.set('');
        this.isEditing.set(true);
    }

    cancelEdit(): void {
        const employee = this.employee();
        if (employee) {
            this.syncFormFromEmployee(employee);
        }
        this.applySocialInsuranceDraft(this.socialInsuranceSnapshot);
        this.syncFormFromSocialInsuranceStatus(this.socialInsuranceStatus());
        this.errorMessage.set('');
        this.postalLookupError.set('');
        this.isEditing.set(false);
    }

    async lookupAddressFromPostalCode(): Promise<void> {
        this.postalLookupError.set('');
        this.isPostalLookupLoading.set(true);

        try {
            const result = await this.postalCodeLookupService.lookup(this.postalCode);
            applyPostalLookupResult(this, result);
        } catch (error) {
            this.postalLookupError.set(this.postalCodeLookupService.toUserMessage(error));
        } finally {
            this.isPostalLookupLoading.set(false);
        }
    }

    async saveEmployee(): Promise<void> {
        const employee = this.employee();
        if (!employee) return;

        // ローディング
        this.isSaving.set(true);
        this.errorMessage.set('');

        if (this.gender !== 'male' && this.gender !== 'female') {
            this.errorMessage.set('性別を選択してください。');
            this.isSaving.set(false);
            return;
        }

        // 更新：従業員情報
        const input: EmployeeInput = toEmployeeInput(employee, {
            employeeNumber: employee.employeeNumber,
            lastName: this.lastName,
            firstName: this.firstName,
            lastNameKana: this.lastNameKana,
            firstNameKana: this.firstNameKana,
            myNumber: employee.myNumber,
            gender: this.gender,
            postalCode: this.postalCode,
            prefecture: this.prefecture,
            city: this.city,
            streetAddress: this.streetAddress,
            buildingName: this.buildingName,
            phoneNumber: this.phoneNumber,
            email: this.email.trim().toLowerCase(),
            birthDate: this.birthDate,
            joinedDate: this.joinedDate,
            employmentType: this.employmentType,
            department: this.department,
            position: this.position,
            status: resolveEmployeeStoredStatus({
                joinedDate: this.joinedDate,
                retiredDate: employee.retiredDate,
            }),
        });

        const currentSocialInsuranceStatus = this.socialInsuranceStatus();
        const employmentStatus = this.judgeSocialInsuranceEmployment();
        const previousJoinedDate = employee.joinedDate;

        try {
            await this.employeeService.updateEmployee(employee.id, input);

            const refreshedEmployee = await this.employeeService.getEmployeeById(employee.id);
            const updatedEmployee = refreshedEmployee ?? { ...employee, ...input };
            if (refreshedEmployee) {
                this.employee.set(refreshedEmployee);
                this.syncFormFromEmployee(refreshedEmployee);
            }

            const qualificationProcedure = await this.procedureService.syncQualificationProcedureForEmployee({
                employee: updatedEmployee,
                healthInsuranceStartDate: currentSocialInsuranceStatus?.healthInsuranceStartDate ?? null,
                healthInsuranceStatus: currentSocialInsuranceStatus?.healthInsuranceStatus,
                pensionInsuranceStatus: currentSocialInsuranceStatus?.pensionInsuranceStatus,
                previousJoinedDate,
            });
            if (qualificationProcedure) {
                this.qualificationProcedure.set(qualificationProcedure);
            } else {
                await this.loadQualificationProcedure();
            }

            if (!currentSocialInsuranceStatus?.id) {
                this.errorMessage.set('従業員情報は保存しましたが、社会保険情報が見つかりません');
                this.isEditing.set(false);
                return;
            }

            const procedureForEnrollment = qualificationProcedure ?? this.qualificationProcedure();

            let healthInsuranceStartDate: string | null = null;
            let pensionInsuranceStartDate: string | null = null;

            if (procedureForEnrollment?.status === 'completed') {
                healthInsuranceStartDate = currentSocialInsuranceStatus.healthInsuranceStartDate;
                pensionInsuranceStartDate = currentSocialInsuranceStatus.pensionInsuranceStartDate;
                const syncedQualificationDate = resolveQualificationDateAfterJoinDateChange(
                    updatedEmployee,
                    previousJoinedDate,
                    procedureForEnrollment,
                );
                if (syncedQualificationDate) {
                    healthInsuranceStartDate = syncedQualificationDate;
                    pensionInsuranceStartDate = syncedQualificationDate;
                }
            }

            const carePeriod = computeCareInsurancePeriod(
                healthInsuranceStartDate,
                currentSocialInsuranceStatus.healthInsuranceEndDate,
                input.birthDate || null,
            );

            const socialInsuranceStatusInput: SocialInsuranceStatusInput = {
                employeeId: employee.id,
                weeklyScheduledWorkHours: this.toNumberOrNull(this.weeklyScheduledWorkHours),
                monthlyScheduledWorkDays: this.toNumberOrNull(this.monthlyScheduledWorkDays),
                prescribedWage: this.toNumberOrNull(this.prescribedWage),
                isStudent: this.isStudent,
                expectedEmploymentOver2Months: this.expectedEmploymentOver2Months,
                healthInsuranceStatus: judgeHealthInsuranceJoinStatus(employmentStatus, input.birthDate),
                pensionInsuranceStatus: judgePensionInsuranceJoinStatus(employmentStatus, input.birthDate),
                careInsuranceStatus: judgeCareInsuranceStatus(
                    currentYearMonth(),
                    healthInsuranceStartDate,
                    currentSocialInsuranceStatus.healthInsuranceEndDate,
                    input.birthDate,
                ),
                healthInsuranceStartDate,
                healthInsuranceEndDate: currentSocialInsuranceStatus.healthInsuranceEndDate,
                pensionInsuranceStartDate,
                pensionInsuranceEndDate: currentSocialInsuranceStatus.pensionInsuranceEndDate,
                careInsuranceStartDate: carePeriod.startDate,
                careInsuranceEndDate: carePeriod.endDate,
                memo: this.insuranceMemo.trim(),
            };

            const syncedSocialInsuranceStatusInput =
                await this.insuranceStatusService.withSyncedCareInsuranceDates(
                    employee.id,
                    socialInsuranceStatusInput,
                    input.birthDate,
                    employmentStatus,
                );

            await this.insuranceStatusService.updateSocialInsuranceStatus(
                currentSocialInsuranceStatus.id,
                syncedSocialInsuranceStatusInput,
            );

            this.employee.set(updatedEmployee);
            const refreshedSocialInsuranceStatus =
                await this.insuranceStatusService.getInsuranceStatusByEmployeeId(employee.id);
            this.socialInsuranceStatus.set(
                refreshedSocialInsuranceStatus ?? {
                    ...currentSocialInsuranceStatus,
                    ...syncedSocialInsuranceStatusInput,
                },
            );
            this.syncFormFromSocialInsuranceStatus(this.socialInsuranceStatus());
            this.isEditing.set(false);
        } catch (error) {
            console.error('従業員の更新に失敗しました', error);
            this.errorMessage.set('従業員の更新に失敗しました');
        } finally {
            this.isSaving.set(false);
        }
    }

    employeeStatusLabel(employee: Employee): string {
        return employeeDisplayStatusLabel(employee);
    }

    editingEmploymentStatusLabel(): string {
        const employee = this.employee();
        if (!employee) return '—';
        return employeeDisplayStatusLabel({
            status: employee.status,
            retiredDate: employee.retiredDate,
            joinedDate: this.joinedDate || employee.joinedDate,
        });
    }

    employeeDisplayStatus(employee: Employee) {
        return resolveEmployeeDisplayStatus(employee);
    }

    isBeforeJoin(employee: Employee): boolean {
        return isEmployeeBeforeJoin(employee);
    }

    isPendingRetirement(employee: Employee): boolean {
        return isEmployeePendingRetirement(employee);
    }

    isFullyRetired(employee: Employee): boolean {
        return isEmployeeFullyRetired(employee);
    }

    genderLabel(gender: Employee['gender']): string {
        return gender === 'female' ? '女性' : '男性';
    }

    dependentStatusLabel(status: Dependent['status']): string {
        return status === 'active' ? '扶養中' : '扶養終了';
    }

    dependentAge(birthDate: string): number | null {
        return this.ageToday(birthDate);
    }

    toggleDependentDetail(dependentId: string): void {
        this.selectedDependentId.update((current) => (current === dependentId ? null : dependentId));
    }

    employeeInitials(employee: Employee): string {
        const last = employee.lastName.trim().charAt(0);
        const first = employee.firstName.trim().charAt(0);
        return `${last}${first}` || '?';
    }

    scrollToSection(sectionId: string): void {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    isOverdueProcedure(procedure: Procedure): boolean {
        return isProcedureOverdue(procedure);
    }

    procedureListLabel(procedure: Procedure): string {
        return procedureTypeMeta(procedure.procedureType).shortLabel;
    }

    procedureDueDateLabel(procedure: Procedure): string {
        if (procedure.status === 'completed') {
            return procedure.submittedDate
                ? `提出 ${this.formatInsuranceDate(procedure.submittedDate)}`
                : '完了';
        }
        if (!procedure.dueDate) return '期限未設定';
        return `期限 ${this.formatInsuranceDate(procedure.dueDate)}`;
    }

    formatAddress(employee: Employee): string {
        const parts = [
            employee.postalCode ? `〒${employee.postalCode}` : '',
            employee.prefecture,
            employee.city,
            employee.streetAddress,
            employee.buildingName,
        ].filter((part) => part.trim());
        return parts.length > 0 ? parts.join(' ') : '—';
    }

    isActiveEmployee(): boolean {
        const employee = this.employee();
        if (!employee) return false;
        const status = resolveEmployeeDisplayStatus(employee);
        return status === 'active' || status === 'before-join';
    }

    canRetireEmployee(): boolean {
        const employee = this.employee();
        if (!employee) return false;
        return isEmployeeActive(employee);
    }

    canReactivateEmployee(): boolean {
        const employee = this.employee();
        if (!employee) return false;
        const status = resolveEmployeeDisplayStatus(employee);
        return status === 'pending-retirement' || status === 'retired';
    }

    formatRetiredDate(retiredDate: Timestamp | null | undefined): string {
        if (!retiredDate) return '—';
        const date = retiredDate.toDate();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    }

    openRetireForm(): void {
        this.retiredDateInput = this.todayDateString();
        this.errorMessage.set('');
        this.isRetireFormOpen.set(true);
    }

    closeRetireForm(): void {
        this.isRetireFormOpen.set(false);
        this.retiredDateInput = '';
        this.errorMessage.set('');
    }

    async retireEmployee(): Promise<void> {
        const employee = this.employee();
        if (!employee || !this.canRetireEmployee()) return;

        const retiredDateInput = this.retiredDateInput.trim();
        if (!retiredDateInput) {
            this.errorMessage.set('退職日を入力してください');
            return;
        }

        const retiredDate = retiredDateFromInput(retiredDateInput);
        if (!retiredDate) {
            this.errorMessage.set('退職日の形式が正しくありません');
            return;
        }

        this.isRetiring.set(true);
        this.errorMessage.set('');

        const input: EmployeeInput = toEmployeeInput(employee, {
            status: 'retired',
            retiredDate,
        });

        try {
            await this.employeeService.updateEmployee(employee.id, input);
            const updatedEmployee = { ...employee, ...input };
            this.employee.set(updatedEmployee);
            this.closeRetireForm();
            if (this.isEditing()) {
                this.syncFormFromEmployee(updatedEmployee);
            }

            const retiredDateStr = this.retiredDateString(retiredDate);
            const lossDate = lossDateFromRetirementDate(retiredDateStr);
            if (lossDate) {
                await this.insuranceStatusService.syncLossDates(employee.id, lossDate);
                const status = await this.insuranceStatusService.getInsuranceStatusByEmployeeId(employee.id);
                this.socialInsuranceStatus.set(status);
                this.syncFormFromSocialInsuranceStatus(status);
            }

            const lossProcedure = await this.procedureService.syncLossProcedureForEmployee(updatedEmployee);
            this.lossProcedure.set(lossProcedure);
        } catch (error) {
            console.error('退職処理に失敗しました', error);
            this.errorMessage.set('退職処理に失敗しました');
        } finally {
            this.isRetiring.set(false);
        }
    }

    async reactivateEmployee(): Promise<void> {
        const employee = this.employee();
        if (!employee || !this.canReactivateEmployee()) return;

        const confirmed = await this.confirmService.confirm('在籍に戻しますか？退職日はクリアされます。', {
            confirmLabel: '在籍に戻す',
        });
        if (!confirmed) return;

        this.isRetiring.set(true);
        this.errorMessage.set('');

        const input: EmployeeInput = toEmployeeInput(employee, {
            status: 'active',
            retiredDate: null,
        });

        try {
            await this.employeeService.updateEmployee(employee.id, input);
            const updatedEmployee = { ...employee, ...input };
            this.employee.set(updatedEmployee);
            if (this.isEditing()) {
                this.syncFormFromEmployee(updatedEmployee);
            }

            await this.insuranceStatusService.clearLossDates(employee.id);
            const status = await this.insuranceStatusService.getInsuranceStatusByEmployeeId(employee.id);
            this.socialInsuranceStatus.set(status);
            this.syncFormFromSocialInsuranceStatus(status);
        } catch (error) {
            console.error('在籍への復帰に失敗しました', error);
            this.errorMessage.set('在籍への復帰に失敗しました');
        } finally {
            this.isRetiring.set(false);
        }
    }

    displayValue(value: string | number | null | undefined): string {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'number') return String(value);
        const trimmed = value.trim();
        return trimmed ? trimmed : '—';
    }

    employmentTypeLabel(type: EmploymentType): string {
        if (type === 'full-time') return '正社員';
        if (type === 'part-time') return 'パート・アルバイト';
        return '—';
    }

    displayOfficeNumber(value: number | null | undefined): string {
        return value !== null && value !== undefined ? String(value) : '—';
    }

    yesNoLabel(value: boolean): string {
        return value ? 'はい' : 'いいえ';
    }

    hasEmploymentType(): boolean {
        return this.employmentType !== null;
    }

    isPartTimeEmployment(): boolean {
        return this.employmentType === 'part-time';
    }

    onEmploymentTypeChange(): void {
        if (!this.isPartTimeEmployment()) {
            this.weeklyScheduledWorkHours = '';
            this.monthlyScheduledWorkDays = '';
            this.prescribedWage = '';
            this.isStudent = false;
            this.expectedEmploymentOver2Months = false;
        }
    }

    // ---- 社会保険：簡易判定（プロトタイプ用） ----
    // 1. 正社員 → 原則対象
    // 2. パート・アルバイト → 4分の3基準 → 満たせば対象
    // 3. 4分の3を満たさない → 短時間労働者の条件 → すべて満たせば対象
    // 4. どちらも満たさない → 対象外
    /** 雇用形態・労働時間に基づく社会保険の加入要件（年齢は含まない） */
    private judgeSocialInsuranceEmployment(): insuranceJoinStatus {
        // 雇用区分がない場合は判定不可
        if (!this.hasEmploymentType()) return 'unknown';
        // 正社員は原則対象
        if (!this.isPartTimeEmployment()) return 'active';

        // パート・アルバイトの場合は4分の3基準をチェック
        // 週の所定労働時間、月の所定労働日数、所定内賃金
        const weeklyHours = this.toNumberOrNull(this.weeklyScheduledWorkHours);
        const monthlyDays = this.toNumberOrNull(this.monthlyScheduledWorkDays);
        const wage = this.toNumberOrNull(this.prescribedWage);
        // 入力がない場合、入力が不正な場合は判定不可
        if (weeklyHours === null || monthlyDays === null || wage === null) return 'unknown';
        if (weeklyHours <= 0 || monthlyDays <= 0 || wage < 0) return 'unknown';

        // 4分の3基準をチェック
        if (this.meetsThreeQuartersRule(weeklyHours, monthlyDays)) return 'active';
        // 短時間労働者の条件をチェック
        if (this.meetsShortTimeWorkerConditions(weeklyHours, monthlyDays, wage)) return 'active';
        return 'inactive';
    }

    // 社会保険の判定
    displayInsuranceStatus(insuranceStatus: insuranceJoinStatus): string {
        return insuranceStatus === 'active' ? '対象' : insuranceStatus === 'inactive' ? '対象外' : '未設定';
    }

    formatInsuranceDate(value: string | null | undefined): string {
        return formatInsuranceDate(value);
    }

    resolveDisplayQualificationDate(): string | null {
        const employee = this.employee();
        if (!employee) return null;

        return resolvePreviewQualificationDate(employee, {
            joinedDate: this.isEditing() ? this.joinedDate : employee.joinedDate,
            healthInsuranceStartDate: this.socialInsuranceStatus()?.healthInsuranceStartDate ?? null,
            procedure: this.qualificationProcedure(),
        });
    }

    formatHealthStartDateDisplay(): InsuranceDateDisplay {
        const date = this.resolveDisplayQualificationDate();
        const period = computeInsurancePremiumPeriod(
            date,
            this.emptyToNullDate(this.healthInsuranceEndDate),
        );
        return this.resolveDateWithPremiumMonth(date, period.premiumStartYearMonth, '開始月');
    }

    formatHealthEndDateDisplay(): InsuranceDateDisplay {
        return this.resolveDateWithPremiumMonth(
            this.emptyToNullDate(this.healthInsuranceEndDate),
            this.healthPensionPremiumPeriod().premiumEndYearMonth,
            '終了月',
        );
    }

    formatPensionStartDateDisplay(): InsuranceDateDisplay {
        return this.formatHealthStartDateDisplay();
    }

    formatPensionEndDateDisplay(): InsuranceDateDisplay {
        return this.formatHealthEndDateDisplay();
    }

    formatCareStartDateDisplay(): InsuranceDateDisplay {
        const period = computeCareInsurancePeriod(
            this.resolveDisplayQualificationDate(),
            this.emptyToNullDate(this.healthInsuranceEndDate),
            this.birthDateForInsuranceJudgment(),
        );
        return this.resolveDateWithPremiumMonth(
            period.startDate,
            period.premiumStartYearMonth,
            '開始月',
        );
    }

    formatCareEndDateDisplay(): InsuranceDateDisplay {
        const period = this.careInsurancePeriodForDisplay();
        return this.resolveDateWithPremiumMonth(
            period.endDate,
            period.premiumEndYearMonth,
            '終了月',
        );
    }

    private resolveDateWithPremiumMonth(
        date: string | null,
        yearMonth: string | null,
        monthPrefix: '開始月' | '終了月',
    ): InsuranceDateDisplay {
        if (!date) return { main: '—', monthNote: null };
        const formatted = this.formatInsuranceDate(date);
        if (!yearMonth) return { main: formatted, monthNote: null };
        return {
            main: formatted,
            monthNote: `${monthPrefix}${formatYearMonthLabel(yearMonth)}`,
        };
    }

    /** 事業所の通常労働者に対する4分の3基準（週の時間・月の日数の両方） */
    private meetsThreeQuartersRule(employeeWeeklyHours: number, employeeMonthlyDays: number): boolean {
        const regularWeekly = this.office()?.regularWeeklyScheduledWorkHours ?? null;
        const regularMonthlyDays = this.office()?.regularMonthlyScheduledWorkDays ?? null;
        if (
            regularWeekly === null ||
            regularWeekly <= 0 ||
            regularMonthlyDays === null ||
            regularMonthlyDays <= 0
        ) {
            return false;
        }

        return (
            employeeWeeklyHours >= regularWeekly * 0.75 &&
            employeeMonthlyDays >= regularMonthlyDays * 0.75
        );
    }

    /** 短時間労働者の加入要件（絶対基準） */
    private meetsShortTimeWorkerConditions(
        employeeWeeklyHours: number,
        employeeMonthlyDays: number,
        wage: number,
    ): boolean {
        return (
            employeeWeeklyHours >= 20 &&
            employeeMonthlyDays >= 11 &&
            wage >= 88000 &&
            this.expectedEmploymentOver2Months &&
            !this.isStudent
        );
    }

    // 文字列・数値入力を数値に変換する（type="number" の ngModel は number になる）
    private toNumberOrNull(value: string | number | null | undefined): number | null {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const val = value.trim();
        if (!val) return null;
        const num = Number(val);
        return Number.isFinite(num) ? num : null;
    }

    // 生年月日から年齢を計算する
    private ageToday(birthDate: string): number | null {
        if (!birthDate) return null;
        const d = new Date(birthDate);
        if (Number.isNaN(d.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
        return age;
    }

    // 従業員情報をフォームに同期する
    private syncFormFromEmployee(employee: Employee): void {
        this.lastName = employee.lastName;
        this.firstName = employee.firstName;
        this.lastNameKana = employee.lastNameKana;
        this.firstNameKana = employee.firstNameKana;
        this.myNumber = employee.myNumber;
        this.gender = employee.gender;
        this.postalCode = employee.postalCode;
        this.prefecture = employee.prefecture;
        this.city = employee.city;
        this.streetAddress = employee.streetAddress;
        this.buildingName = employee.buildingName;
        this.phoneNumber = employee.phoneNumber;
        this.email = employee.email;
        this.employeeNumber = employee.employeeNumber;
        this.birthDate = employee.birthDate;
        this.joinedDate = employee.joinedDate;
        this.department = employee.department;
        this.position = employee.position;
        this.employmentType = employee.employmentType;
    }

    private syncFormFromSocialInsuranceStatus(status: SocialInsuranceStatus | null): void {
        this.weeklyScheduledWorkHours = this.numberToFormValue(status?.weeklyScheduledWorkHours);
        this.monthlyScheduledWorkDays = this.numberToFormValue(status?.monthlyScheduledWorkDays);
        this.prescribedWage = this.numberToFormValue(status?.prescribedWage);
        this.isStudent = status?.isStudent ?? false;
        this.expectedEmploymentOver2Months = status?.expectedEmploymentOver2Months ?? false;
        this.healthInsuranceStartDate = status?.healthInsuranceStartDate ?? '';
        this.healthInsuranceEndDate = status?.healthInsuranceEndDate ?? '';
        this.pensionInsuranceStartDate = status?.pensionInsuranceStartDate ?? '';
        this.pensionInsuranceEndDate = status?.pensionInsuranceEndDate ?? '';
        this.careInsuranceStartDate = status?.careInsuranceStartDate ?? '';
        this.careInsuranceEndDate = status?.careInsuranceEndDate ?? '';
        this.insuranceMemo = status?.memo ?? '';
        this.socialInsuranceSnapshot = this.captureSocialInsuranceDraft();
    }

    private emptyToNullDate(value: string): string | null {
        const trimmed = value.trim();
        return trimmed || null;
    }

    private numberToFormValue(value: number | null | undefined): string | number {
        return value !== null && value !== undefined ? value : '';
    }

    private todayDateString(): string {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    private createEmptySocialInsuranceDraft(): SocialInsuranceDraft {
        return {
            weeklyScheduledWorkHours: '',
            monthlyScheduledWorkDays: '',
            prescribedWage: '',
            isStudent: false,
            expectedEmploymentOver2Months: false,
        };
    }

    private captureSocialInsuranceDraft(): SocialInsuranceDraft {
        return {
            weeklyScheduledWorkHours: this.weeklyScheduledWorkHours,
            monthlyScheduledWorkDays: this.monthlyScheduledWorkDays,
            prescribedWage: this.prescribedWage,
            isStudent: this.isStudent,
            expectedEmploymentOver2Months: this.expectedEmploymentOver2Months,
        };
    }

    private applySocialInsuranceDraft(draft: SocialInsuranceDraft): void {
        this.weeklyScheduledWorkHours = draft.weeklyScheduledWorkHours;
        this.monthlyScheduledWorkDays = draft.monthlyScheduledWorkDays;
        this.prescribedWage = draft.prescribedWage;
        this.isStudent = draft.isStudent;
        this.expectedEmploymentOver2Months = draft.expectedEmploymentOver2Months;
    }

}
