import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Timestamp } from 'firebase/firestore';

import { Employee, EmployeeInput, EmployeeStatus, EmploymentType } from '../models/employee.models';
import { EmployeeService } from '../services/employee.service';
import { Office } from '../../company/models/office.model';
import { OfficeService } from '../../company/services/office.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { insuranceJoinStatus, SocialInsuranceStatus, SocialInsuranceStatusInput } from '../../social-insurance/models/social-insurance-status.model';

type SocialInsuranceDraft = {
    weeklyScheduledWorkHours: string | number;
    monthlyScheduledWorkDays: string | number;
    prescribedWage: string | number;
    isStudent: boolean;
    expectedEmploymentOver2Months: boolean;
};

@Component({
    selector: 'app-employee-detail-page',
    standalone: true,
    imports: [FormsModule, RouterLink],
    templateUrl: './employee-detail-page.component.html',
})

export class EmployeeDetailPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);

    employee = signal<Employee | null>(null);
    office = signal<Office | null>(null);
    officeName = signal<string>('');

    isLoading = signal<boolean>(false);
    isSaving = signal<boolean>(false);
    isRetiring = signal<boolean>(false);
    isEditing = signal<boolean>(false);
    isRetireFormOpen = signal<boolean>(false);
    errorMessage = signal<string>('');
    age = computed(() => this.ageToday(this.birthDate));

    retiredDateInput = '';

    lastName = '';
    firstName = '';
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

    private socialInsuranceSnapshot: SocialInsuranceDraft = this.createEmptySocialInsuranceDraft();


    // 社会保険情報
    socialInsuranceStatus = signal<SocialInsuranceStatus | null>(null);

    async ngOnInit() {
        const employeeId = this.route.snapshot.params['employeeId'];

        if (!employeeId) {
            this.errorMessage.set('従業員が見つかりませんでした');
            return;
        }

        await this.loadEmployee(employeeId);
    }

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
            const socialInsuranceStatus = await this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employeeId);
            this.socialInsuranceStatus.set(socialInsuranceStatus);
            this.syncFormFromSocialInsuranceStatus(socialInsuranceStatus);
        } catch (error) {
            console.error('従業員の取得に失敗しました', error);
            this.errorMessage.set('従業員の取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    startEdit(): void {
        const employee = this.employee();
        if (!employee) return;

        this.syncFormFromEmployee(employee);
        this.socialInsuranceSnapshot = this.captureSocialInsuranceDraft();
        this.errorMessage.set('');
        this.isEditing.set(true);
    }

    cancelEdit(): void {
        const employee = this.employee();
        if (employee) {
            this.syncFormFromEmployee(employee);
        }
        this.applySocialInsuranceDraft(this.socialInsuranceSnapshot);
        this.errorMessage.set('');
        this.isEditing.set(false);
    }

    async saveEmployee(): Promise<void> {
        const employee = this.employee();
        if (!employee) return;

        // ローディング
        this.isSaving.set(true);
        this.errorMessage.set('');

        // 更新：従業員情報
        const input: EmployeeInput = {
            companyId: employee.companyId,
            officeId: employee.officeId,
            employeeNumber: this.employeeNumber,
            lastName: this.lastName,
            firstName: this.firstName,
            birthDate: this.birthDate,
            joinedDate: this.joinedDate,
            employmentType: this.employmentType,
            department: this.department,
            position: this.position,
            status: employee.status,
            retiredDate: employee.retiredDate,
        };

        // 更新：社会保険情報
        const currentSocialInsuranceStatus = this.socialInsuranceStatus();
        const socialInsuranceStatusInput: SocialInsuranceStatusInput = {
            employeeId: employee.id,
            weeklyScheduledWorkHours: this.toNumberOrNull(this.weeklyScheduledWorkHours),
            monthlyScheduledWorkDays: this.toNumberOrNull(this.monthlyScheduledWorkDays),
            prescribedWage: this.toNumberOrNull(this.prescribedWage),
            isStudent: this.isStudent,
            expectedEmploymentOver2Months: this.expectedEmploymentOver2Months,
            healthInsuranceStatus: this.judgeHealthInsurance(),
            pensionInsuranceStatus: this.judgePensionInsurance(),
            careInsuranceStatus: this.careInsuranceJudge(),
            healthInsuranceStartDate: currentSocialInsuranceStatus?.healthInsuranceStartDate ?? null,
            healthInsuranceEndDate: currentSocialInsuranceStatus?.healthInsuranceEndDate ?? null,
            pensionInsuranceStartDate: currentSocialInsuranceStatus?.pensionInsuranceStartDate ?? null,
            pensionInsuranceEndDate: currentSocialInsuranceStatus?.pensionInsuranceEndDate ?? null,
            careInsuranceStartDate: currentSocialInsuranceStatus?.careInsuranceStartDate ?? null,
            careInsuranceEndDate: currentSocialInsuranceStatus?.careInsuranceEndDate ?? null,
        };

        try {
            // 更新：従業員情報
            await this.employeeService.updateEmployee(employee.id, input);

            if (!currentSocialInsuranceStatus?.id) {
                throw new Error('社会保険情報が見つかりません');
            }

            await this.socialInsuranceStatusService.updateSocialInsuranceStatus(
                currentSocialInsuranceStatus.id,
                socialInsuranceStatusInput,
            );

            this.employee.set({ ...employee, ...input });
            this.socialInsuranceStatus.set({
                ...currentSocialInsuranceStatus,
                ...socialInsuranceStatusInput,
            });
            this.isEditing.set(false);
        } catch (error) {
            console.error('従業員の更新に失敗しました', error);
            this.errorMessage.set('従業員の更新に失敗しました');
        } finally {
            this.isSaving.set(false);
        }
    }

    statusLabel(status: EmployeeStatus): string {
        return status === 'active' ? '在籍' : '退職';
    }

    isActiveEmployee(): boolean {
        return this.employee()?.status === 'active';
    }

    formatRetiredDate(retiredDate: Timestamp | null | undefined): string {
        if (!retiredDate) return '—';
        const date = retiredDate.toDate();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
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
        if (!employee || employee.status !== 'active') return;

        const retiredDateInput = this.retiredDateInput.trim();
        if (!retiredDateInput) {
            this.errorMessage.set('退職日を入力してください');
            return;
        }

        const retiredDate = new Date(retiredDateInput);
        if (Number.isNaN(retiredDate.getTime())) {
            this.errorMessage.set('退職日の形式が正しくありません');
            return;
        }

        this.isRetiring.set(true);
        this.errorMessage.set('');

        const input: EmployeeInput = {
            companyId: employee.companyId,
            officeId: employee.officeId,
            employeeNumber: employee.employeeNumber,
            lastName: employee.lastName,
            firstName: employee.firstName,
            birthDate: employee.birthDate,
            joinedDate: employee.joinedDate,
            employmentType: employee.employmentType,
            department: employee.department,
            position: employee.position,
            status: 'retired',
            retiredDate: Timestamp.fromDate(retiredDate),
        };

        try {
            await this.employeeService.updateEmployee(employee.id, input);
            this.employee.set({ ...employee, ...input });
            this.closeRetireForm();
            if (this.isEditing()) {
                this.syncFormFromEmployee({ ...employee, ...input });
            }
        } catch (error) {
            console.error('退職処理に失敗しました', error);
            this.errorMessage.set('退職処理に失敗しました');
        } finally {
            this.isRetiring.set(false);
        }
    }

    async reactivateEmployee(): Promise<void> {
        const employee = this.employee();
        if (!employee || employee.status !== 'retired') return;

        if (!confirm('在籍に戻しますか？退職日はクリアされます。')) return;

        this.isRetiring.set(true);
        this.errorMessage.set('');

        const input: EmployeeInput = {
            companyId: employee.companyId,
            officeId: employee.officeId,
            employeeNumber: employee.employeeNumber,
            lastName: employee.lastName,
            firstName: employee.firstName,
            birthDate: employee.birthDate,
            joinedDate: employee.joinedDate,
            employmentType: employee.employmentType,
            department: employee.department,
            position: employee.position,
            status: 'active',
            retiredDate: null,
        };

        try {
            await this.employeeService.updateEmployee(employee.id, input);
            this.employee.set({ ...employee, ...input });
            if (this.isEditing()) {
                this.syncFormFromEmployee({ ...employee, ...input });
            }
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
    judgeHealthInsurance(): insuranceJoinStatus {
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
        return insuranceStatus === 'active' ? '対象' : insuranceStatus === 'inactive' ? '対象外' : '判定不可';
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

    judgePensionInsurance(): insuranceJoinStatus {
        return this.judgeHealthInsurance();
    }

    careInsuranceJudge = computed(() => {
        const age = this.age();
        if(age === null) return 'unknown';
        return age >= 40 && age < 65 ? 'active' : 'inactive';
    })

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
        this.socialInsuranceSnapshot = this.captureSocialInsuranceDraft();
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
