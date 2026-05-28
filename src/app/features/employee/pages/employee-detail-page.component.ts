import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Employee, EmployeeInput, EmployeeStatus } from '../models/employee.models';
import { EmployeeService } from '../services/employee.service';
import { OfficeService } from '../../company/services/office.service';

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

    employee = signal<Employee | null>(null);
    officeName = signal<string>('');

    isLoading = signal<boolean>(false);
    isSaving = signal<boolean>(false);
    isEditing = signal<boolean>(false);
    errorMessage = signal<string>('');

    lastName = '';
    firstName = '';
    employeeNumber = '';
    birthDate = '';
    joinedDate = '';
    department = '';
    position = '';
    status: EmployeeStatus = 'active';

    // 社会保険 加入要件（UIのみ・保存なし）
    employmentType = ''; // 例: fulltime / parttime / contract など（いったん自由入力）
    weeklyScheduledWorkHours = ''; // number入力だが空を許容するため文字列
    monthlyScheduledWorkDays = '';
    prescribedWage = '';
    isStudent = false;
    expectedEmploymentOver2Months = false;

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
        this.officeName.set('');

        try {
            const employee = await this.employeeService.getEmployeeById(employeeId);
            this.employee.set(employee);

            if (!employee) {
                this.errorMessage.set('従業員が見つかりませんでした');
                return;
            }

            const office = await this.officeService.getOfficeById(employee.officeId);
            this.officeName.set(office?.name ?? employee.officeId);
            this.syncFormFromEmployee(employee);
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
        this.errorMessage.set('');
        this.isEditing.set(true);
    }

    cancelEdit(): void {
        const employee = this.employee();
        if (employee) {
            this.syncFormFromEmployee(employee);
        }
        this.errorMessage.set('');
        this.isEditing.set(false);
    }

    async saveEmployee(): Promise<void> {
        const employee = this.employee();
        if (!employee) return;

        this.isSaving.set(true);
        this.errorMessage.set('');

        const input: EmployeeInput = {
            companyId: employee.companyId,
            officeId: employee.officeId,
            employeeNumber: this.employeeNumber,
            lastName: this.lastName,
            firstName: this.firstName,
            birthDate: this.birthDate,
            joinedDate: this.joinedDate,
            department: this.department,
            position: this.position,
            status: this.status,
            retiredDate: employee.retiredDate,
        };

        try {
            await this.employeeService.updateEmployee(employee.id, input);
            this.employee.set({ ...employee, ...input });
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

    // ---- 社会保険：簡易判定（プロトタイプ用） ----
    judgeHealthInsurance(): '対象' | '対象外' | '判定不可' {
        const w = this.toNumberOrNull(this.weeklyScheduledWorkHours);
        const d = this.toNumberOrNull(this.monthlyScheduledWorkDays);
        const wage = this.toNumberOrNull(this.prescribedWage);
        if (w === null || d === null || wage === null) return '判定不可';
        if (w <= 0 || d <= 0 || wage < 0) return '判定不可';

        // 参考ルール（簡易）
        const ok =
            w >= 20 &&
            d >= 11 &&
            wage >= 88000 &&
            this.expectedEmploymentOver2Months &&
            !this.isStudent;
        return ok ? '対象' : '対象外';
    }

    judgePensionInsurance(): '対象' | '対象外' | '判定不可' {
        // 健康保険と同じ入力要件で暫定判定（簡易）
        return this.judgeHealthInsurance();
    }

    judgeCareInsurance(): '対象' | '対象外' | '判定不可' {
        const birth = this.employee()?.birthDate ?? '';
        const age = this.ageToday(birth);
        if (age === null) return '判定不可';
        // 参考ルール（簡易）：40歳以上65歳未満を対象
        return age >= 40 && age < 65 ? '対象' : '対象外';
    }

    private toNumberOrNull(value: string): number | null {
        const v = value.trim();
        if (!v) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

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

    private syncFormFromEmployee(employee: Employee): void {
        this.lastName = employee.lastName;
        this.firstName = employee.firstName;
        this.employeeNumber = employee.employeeNumber;
        this.birthDate = employee.birthDate;
        this.joinedDate = employee.joinedDate;
        this.department = employee.department;
        this.position = employee.position;
        this.status = employee.status;
    }
}
