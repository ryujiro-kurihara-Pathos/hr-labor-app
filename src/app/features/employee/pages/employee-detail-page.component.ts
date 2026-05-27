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
