import { Component, signal, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Employee, EmployeeStatus, EmploymentType } from '../models/employee.models';
import { EmployeeService } from '../services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { OfficeService } from '../../company/services/office.service';

@Component({
    selector: 'app-employee-page',
    standalone: true,
    imports: [RouterLink, FormsModule],
    templateUrl: './employee-page.component.html',
})

export class EmployeePageComponent {
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);

    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    companyId = signal<string>('');
    officeNameById = signal<Record<string, string>>({});

    employees = signal<Employee[]>([]);
    keyword = signal<string>('');
    selectedOfficeId = signal<string>('');
    selectedStatus = signal<'' | EmployeeStatus>('');

    officeOptions = computed(() => {
        const map = this.officeNameById();
        return Object.entries(map)
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    });

    filteredEmployees = computed(() => this.searchEmployees());

    hasActiveFilters = computed(
        () => Boolean(this.keyword().trim() || this.selectedOfficeId() || this.selectedStatus()),
    );

    async ngOnInit() {
        const authUser = this.authService.getCurrentAuthUser();
        if (!authUser) return;
        const appUser = await this.userService.getUserByUid(authUser.uid);
        if (!appUser) return;

        this.companyId.set(appUser.companyId);
        await this.loadEmployees();
    }

    async loadEmployees(): Promise<void> {
        const companyId = this.companyId();
        if (!companyId) return;

        this.isLoading.set(true);
        this.errorMessage.set('');

        try {
            const [employees, offices] = await Promise.all([
                this.employeeService.getEmployeesByCompanyId(companyId),
                this.officeService.getOfficesByCompanyId(companyId),
            ]);
            this.employees.set(employees);

            const map: Record<string, string> = {};
            for (const office of offices) {
                map[office.id] = office.name;
            }
            this.officeNameById.set(map);
        } catch (error) {
            this.employees.set([]);
            this.officeNameById.set({});
            this.errorMessage.set('従業員の取得に失敗しました');
            console.error('従業員の取得に失敗しました', error);
        } finally {
            this.isLoading.set(false);
        }
    }

    statusLabel(status: EmployeeStatus): string {
        return status === 'active' ? '在籍' : '退職';
    }

    employmentTypeLabel(type: EmploymentType): string {
        if (type === 'full-time') return '正社員';
        if (type === 'part-time') return 'パート・アルバイト';
        return '—';
    }

    formatDate(value: string): string {
        return value.trim() || '—';
    }

    isPendingRetirement(employee: Employee): boolean {
        if (employee.status !== 'retired' || !employee.retiredDate) return false;

        const retired = employee.retiredDate.toDate();
        const today = new Date();
        retired.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return retired >= today;
    }

    statusBadgeLabel(employee: Employee): string {
        if (this.isPendingRetirement(employee)) {
            const d = employee.retiredDate!.toDate();
            return `${d.getMonth() + 1}/${d.getDate()}退職予定`;
        }
        return this.statusLabel(employee.status);
    }

    isRetiredBadge(employee: Employee): boolean {
        return employee.status === 'retired' && !this.isPendingRetirement(employee);
    }

    searchEmployees(): Employee[] {
        const keyword = this.keyword().trim().toLowerCase();
        const officeId = this.selectedOfficeId();
        const status = this.selectedStatus();
        let list = this.employees();

        if (officeId) {
            list = list.filter((employee) => employee.officeId === officeId);
        }
        if (status) {
            list = list.filter((employee) => employee.status === status);
        }
        if (!keyword) return list;

        return list.filter(
            (employee) =>
                `${employee.lastName}${employee.firstName}`.toLowerCase().includes(keyword) ||
                `${employee.lastNameKana}${employee.firstNameKana}`.toLowerCase().includes(keyword) ||
                employee.employeeNumber.toLowerCase().includes(keyword),
        );
    }
}
