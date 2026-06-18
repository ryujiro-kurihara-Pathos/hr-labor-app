import { Component, signal, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Employee, EmploymentType } from '../models/employee.models';
import {
    EmployeeStatusFilter,
    employeeDisplayStatusLabel,
    isEmployeeBeforeJoin,
    isEmployeeFullyRetired,
    isEmployeePendingRetirement,
    matchesEmployeeStatusFilter,
} from '../utils/employee-status-display.util';
import { EmployeeService } from '../services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { OfficeService } from '../../company/services/office.service';
import { SocialInsuranceProcedureService } from '../../social-insurance/services/social-insurance-procedure.service';
import { Procedure } from '../../social-insurance/models/procedures.model';
import {
    compareProceduresForList,
    isProcedureOverdue,
    procedureStatusLabel,
    procedureTypeMeta,
    todayDateString,
} from '../../social-insurance/utils/procedure-display.util';

export type EmployeeListRow = {
    employee: Employee;
    procedures: Procedure[];
    visibleProcedures: Procedure[];
    hiddenProcedureCount: number;
};

const EMPLOYEE_LIST_MAX_VISIBLE_PROCEDURES = 2;

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
    private readonly procedureService = inject(SocialInsuranceProcedureService);

    readonly procedureStatusLabel = procedureStatusLabel;
    readonly procedureTypeMeta = procedureTypeMeta;

    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    companyId = signal<string>('');
    officeNameById = signal<Record<string, string>>({});

    employees = signal<Employee[]>([]);
    procedures = signal<Procedure[]>([]);
    keyword = signal<string>('');
    selectedOfficeId = signal<string>('');
    selectedStatus = signal<EmployeeStatusFilter>('');

    officeOptions = computed(() => {
        const map = this.officeNameById();
        return Object.entries(map)
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    });

    proceduresByEmployeeId = computed(() => {
        const today = todayDateString();
        const map = new Map<string, Procedure[]>();

        for (const procedure of this.procedures()) {
            if (!procedure.employeeId) continue;

            const list = map.get(procedure.employeeId) ?? [];
            list.push(procedure);
            map.set(procedure.employeeId, list);
        }

        for (const [employeeId, list] of map.entries()) {
            map.set(
                employeeId,
                [...list].sort((a, b) => compareProceduresForList(a, b, today)),
            );
        }

        return map;
    });

    filteredEmployees = computed(() => this.searchEmployees());

    employeeRows = computed((): EmployeeListRow[] => {
        const procedureMap = this.proceduresByEmployeeId();

        return this.filteredEmployees()
            .map((employee) => {
                const procedures = procedureMap.get(employee.id) ?? [];
                return {
                    employee,
                    procedures,
                    visibleProcedures: procedures.slice(0, EMPLOYEE_LIST_MAX_VISIBLE_PROCEDURES),
                    hiddenProcedureCount: Math.max(0, procedures.length - EMPLOYEE_LIST_MAX_VISIBLE_PROCEDURES),
                };
            })
            .sort((a, b) => {
                const aPending = a.procedures.some((p) => p.status !== 'completed') ? 0 : 1;
                const bPending = b.procedures.some((p) => p.status !== 'completed') ? 0 : 1;
                if (aPending !== bPending) return aPending - bPending;

                const aOverdue = a.procedures.some((p) => isProcedureOverdue(p)) ? 0 : 1;
                const bOverdue = b.procedures.some((p) => isProcedureOverdue(p)) ? 0 : 1;
                if (aOverdue !== bOverdue) return aOverdue - bOverdue;

                const nameA = `${a.employee.lastName}${a.employee.firstName}`;
                const nameB = `${b.employee.lastName}${b.employee.firstName}`;
                return nameA.localeCompare(nameB, 'ja');
            });
    });

    pendingProcedureEmployeeCount = computed(
        () =>
            this.filteredEmployees().filter((employee) =>
                (this.proceduresByEmployeeId().get(employee.id) ?? []).some(
                    (procedure) => procedure.status !== 'completed',
                ),
            ).length,
    );

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
            const [employees, offices, procedures] = await Promise.all([
                this.employeeService.getEmployeesByCompanyId(companyId),
                this.officeService.getOfficesByCompanyId(companyId),
                this.procedureService.getProcedures(),
            ]);
            this.employees.set(employees);
            this.procedures.set(procedures.filter((procedure) => procedure.companyId === companyId));

            const map: Record<string, string> = {};
            for (const office of offices) {
                map[office.id] = office.name;
            }
            this.officeNameById.set(map);
        } catch (error) {
            this.employees.set([]);
            this.procedures.set([]);
            this.officeNameById.set({});
            this.errorMessage.set('従業員の取得に失敗しました');
            console.error('従業員の取得に失敗しました', error);
        } finally {
            this.isLoading.set(false);
        }
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
        return isEmployeePendingRetirement(employee);
    }

    isBeforeJoin(employee: Employee): boolean {
        return isEmployeeBeforeJoin(employee);
    }

    statusBadgeLabel(employee: Employee): string {
        return employeeDisplayStatusLabel(employee);
    }

    isRetiredBadge(employee: Employee): boolean {
        return isEmployeeFullyRetired(employee);
    }

    isOverdueProcedure(procedure: Procedure): boolean {
        return isProcedureOverdue(procedure);
    }

    procedureChipLabel(procedure: Procedure): string {
        return procedureTypeMeta(procedure.procedureType).shortLabel;
    }

    isCompletedProcedure(procedure: Procedure): boolean {
        return procedure.status === 'completed';
    }

    hasPendingProcedures(procedures: Procedure[]): boolean {
        return procedures.some((procedure) => procedure.status !== 'completed');
    }

    dueDateLabel(procedure: Procedure): string {
        if (!procedure.dueDate) return '期限未設定';
        const [y, m, d] = procedure.dueDate.split('-');
        if (!y || !m || !d) return procedure.dueDate;
        return `${y}/${m}/${d}`;
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
            list = list.filter((employee) => matchesEmployeeStatusFilter(employee, status));
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
