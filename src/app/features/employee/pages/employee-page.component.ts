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
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { Procedure } from '../../social-insurance/models/procedures.model';
import {
    insuranceJoinStatus,
    SocialInsuranceStatus,
} from '../../social-insurance/models/social-insurance-status.model';
import {
    compareProceduresForList,
    isProcedureOverdue,
    procedureStatusLabel,
    procedureTypeMeta,
    todayDateString,
} from '../../social-insurance/utils/procedure-display.util';
import {
    InsuranceJoinKind,
    insuranceJoinStatusListLabel,
    isInsuranceEnrolled,
    isUnsetInsuranceStatus,
    memoPreview,
} from '../../social-insurance/utils/social-insurance-status-display.util';
import { needsPartTimeInsuranceJudgmentWarning } from '../../social-insurance/utils/part-time-insurance-judgment.util';

export type EmployeeListRow = {
    employee: Employee;
    procedures: Procedure[];
    visibleProcedures: Procedure[];
    hiddenProcedureCount: number;
    insuranceStatus: SocialInsuranceStatus | null;
};

type InsuranceStatusFilter = '' | insuranceJoinStatus;

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
    private readonly statusService = inject(SocialInsuranceStatusService);

    readonly procedureStatusLabel = procedureStatusLabel;
    readonly procedureTypeMeta = procedureTypeMeta;
    readonly memoPreview = memoPreview;

    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    companyId = signal<string>('');
    officeNameById = signal<Record<string, string>>({});

    employees = signal<Employee[]>([]);
    procedures = signal<Procedure[]>([]);
    statusByEmployeeId = signal<Record<string, SocialInsuranceStatus>>({});
    submittedQualificationEmployeeIds = signal<Set<string>>(new Set());

    keyword = signal<string>('');
    selectedOfficeId = signal<string>('');
    selectedStatus = signal<EmployeeStatusFilter>('');
    healthFilter = signal<InsuranceStatusFilter>('');
    pensionFilter = signal<InsuranceStatusFilter>('');
    careFilter = signal<InsuranceStatusFilter>('');
    unsetOnly = signal(false);
    pendingOnly = signal(false);
    filtersExpanded = signal(false);

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
        const statusMap = this.statusByEmployeeId();

        return this.filteredEmployees()
            .map((employee) => {
                const procedures = procedureMap.get(employee.id) ?? [];
                return {
                    employee,
                    procedures,
                    visibleProcedures: procedures.slice(0, EMPLOYEE_LIST_MAX_VISIBLE_PROCEDURES),
                    hiddenProcedureCount: Math.max(0, procedures.length - EMPLOYEE_LIST_MAX_VISIBLE_PROCEDURES),
                    insuranceStatus: statusMap[employee.id] ?? null,
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

    unsetCount = computed(
        () =>
            this.employees().filter((employee) =>
                isUnsetInsuranceStatus(this.statusByEmployeeId()[employee.id] ?? null),
            ).length,
    );

    laborConditionWarningCount = computed(
        () =>
            this.employees().filter((employee) =>
                this.needsLaborConditionWarningInternal(
                    employee,
                    this.statusByEmployeeId()[employee.id] ?? null,
                ),
            ).length,
    );

    pendingProcedureEmployeeCount = computed(
        () =>
            this.filteredEmployees().filter((employee) =>
                (this.proceduresByEmployeeId().get(employee.id) ?? []).some(
                    (procedure) => procedure.status !== 'completed',
                ),
            ).length,
    );

    activeEmployeeCount = computed(
        () =>
            this.employees().filter(
                (employee) =>
                    !isEmployeeBeforeJoin(employee) && !isEmployeeFullyRetired(employee),
            ).length,
    );

    hasActiveFilters = computed(
        () =>
            Boolean(
                this.keyword().trim() ||
                    this.selectedOfficeId() ||
                    this.selectedStatus() ||
                    this.healthFilter() ||
                    this.pensionFilter() ||
                    this.careFilter() ||
                    this.unsetOnly() ||
                    this.pendingOnly(),
            ),
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
            const [employees, offices, procedures, qualificationProcedures] = await Promise.all([
                this.employeeService.getEmployeesByCompanyId(companyId),
                this.officeService.getOfficesByCompanyId(companyId),
                this.procedureService.getProcedures(),
                this.procedureService.listQualificationProceduresByCompanyId(companyId),
            ]);
            this.employees.set(employees);
            this.procedures.set(procedures.filter((procedure) => procedure.companyId === companyId));

            const map: Record<string, string> = {};
            for (const office of offices) {
                map[office.id] = office.name;
            }
            this.officeNameById.set(map);

            const statuses = await this.statusService.listByEmployeeIds(
                employees.map((employee) => employee.id),
            );
            const statusMap: Record<string, SocialInsuranceStatus> = {};
            for (const status of statuses) {
                statusMap[status.employeeId] = status;
            }
            this.statusByEmployeeId.set(statusMap);

            const submittedIds = new Set<string>();
            for (const procedure of qualificationProcedures) {
                if (procedure.status === 'completed' && procedure.employeeId) {
                    submittedIds.add(procedure.employeeId);
                }
            }
            this.submittedQualificationEmployeeIds.set(submittedIds);
        } catch (error) {
            this.employees.set([]);
            this.procedures.set([]);
            this.statusByEmployeeId.set({});
            this.submittedQualificationEmployeeIds.set(new Set());
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

    insuranceStatusForRow(row: EmployeeListRow, kind: InsuranceJoinKind): insuranceJoinStatus {
        const status = row.insuranceStatus;
        if (!status) return 'unknown';
        if (kind === 'health') return status.healthInsuranceStatus;
        if (kind === 'pension') return status.pensionInsuranceStatus;
        return status.careInsuranceStatus;
    }

    insuranceJoinStatusLabelForRow(row: EmployeeListRow, kind: InsuranceJoinKind): string {
        const qualificationSubmitted = this.submittedQualificationEmployeeIds().has(row.employee.id);
        return insuranceJoinStatusListLabel(
            this.insuranceStatusForRow(row, kind),
            kind,
            row.insuranceStatus,
            qualificationSubmitted,
        );
    }

    isInsuranceEnrolledForRow(row: EmployeeListRow, kind: InsuranceJoinKind): boolean {
        const qualificationSubmitted = this.submittedQualificationEmployeeIds().has(row.employee.id);
        return isInsuranceEnrolled(
            this.insuranceStatusForRow(row, kind),
            kind,
            row.insuranceStatus,
            qualificationSubmitted,
        );
    }

    needsLaborConditionWarning(row: EmployeeListRow): boolean {
        return this.needsLaborConditionWarningInternal(row.employee, row.insuranceStatus);
    }

    employeeDetailLink(employeeId: string): string[] {
        return ['/employees', employeeId];
    }

    employeeInitial(employee: Employee): string {
        const initial = employee.lastName?.trim().charAt(0) || employee.firstName?.trim().charAt(0);
        return initial || '?';
    }

    clearFilters(): void {
        this.keyword.set('');
        this.selectedOfficeId.set('');
        this.selectedStatus.set('');
        this.healthFilter.set('');
        this.pensionFilter.set('');
        this.careFilter.set('');
        this.unsetOnly.set(false);
        this.pendingOnly.set(false);
    }

    applyQuickFilter(mode: 'all' | 'active' | 'unset' | 'pending'): void {
        this.clearFilters();
        if (mode === 'active') {
            this.selectedStatus.set('active');
        } else if (mode === 'unset') {
            this.unsetOnly.set(true);
        } else if (mode === 'pending') {
            this.pendingOnly.set(true);
        }
    }

    isQuickFilterActive(mode: 'all' | 'active' | 'unset' | 'pending'): boolean {
        if (mode === 'all') {
            return !this.hasActiveFilters();
        }
        if (mode === 'active') {
            return this.selectedStatus() === 'active' && !this.keyword().trim()
                && !this.selectedOfficeId() && !this.healthFilter() && !this.pensionFilter()
                && !this.careFilter() && !this.unsetOnly() && !this.pendingOnly();
        }
        if (mode === 'unset') {
            return this.unsetOnly() && !this.keyword().trim() && !this.selectedOfficeId()
                && !this.selectedStatus() && !this.healthFilter() && !this.pensionFilter()
                && !this.careFilter() && !this.pendingOnly();
        }
        return this.pendingOnly() && !this.keyword().trim() && !this.selectedOfficeId()
            && !this.selectedStatus() && !this.healthFilter() && !this.pensionFilter()
            && !this.careFilter() && !this.unsetOnly();
    }

    toggleFiltersExpanded(): void {
        this.filtersExpanded.update((value) => !value);
    }

    hasOverdueProcedures(procedures: Procedure[]): boolean {
        return procedures.some(
            (procedure) => procedure.status !== 'completed' && isProcedureOverdue(procedure),
        );
    }

    formatJoinedDate(value: string): string {
        const trimmed = value.trim();
        if (!trimmed) return '—';
        const [y, m, d] = trimmed.split('-');
        if (y && m && d) return `${y}/${m}/${d}`;
        return trimmed;
    }

    private needsLaborConditionWarningInternal(
        employee: Employee,
        status: SocialInsuranceStatus | null,
    ): boolean {
        return needsPartTimeInsuranceJudgmentWarning(employee.employmentType, status);
    }

    searchEmployees(): Employee[] {
        const keyword = this.keyword().trim().toLowerCase();
        const officeId = this.selectedOfficeId();
        const status = this.selectedStatus();
        const health = this.healthFilter();
        const pension = this.pensionFilter();
        const care = this.careFilter();
        const unsetOnly = this.unsetOnly();
        const pendingOnly = this.pendingOnly();
        const statusMap = this.statusByEmployeeId();
        const procedureMap = this.proceduresByEmployeeId();
        let list = this.employees();

        if (officeId) {
            list = list.filter((employee) => employee.officeId === officeId);
        }
        if (status) {
            list = list.filter((employee) => matchesEmployeeStatusFilter(employee, status));
        }
        if (unsetOnly) {
            list = list.filter((employee) => isUnsetInsuranceStatus(statusMap[employee.id] ?? null));
        }
        if (pendingOnly) {
            list = list.filter((employee) =>
                (procedureMap.get(employee.id) ?? []).some((procedure) => procedure.status !== 'completed'),
            );
        }

        list = list.filter((employee) => {
            const insuranceStatus = statusMap[employee.id] ?? null;
            const row: EmployeeListRow = {
                employee,
                procedures: [],
                visibleProcedures: [],
                hiddenProcedureCount: 0,
                insuranceStatus,
            };
            if (health && this.insuranceStatusForRow(row, 'health') !== health) return false;
            if (pension && this.insuranceStatusForRow(row, 'pension') !== pension) return false;
            if (care && this.insuranceStatusForRow(row, 'care') !== care) return false;
            return true;
        });

        if (!keyword) return list;

        return list.filter(
            (employee) =>
                `${employee.lastName}${employee.firstName}`.toLowerCase().includes(keyword) ||
                `${employee.lastNameKana}${employee.firstNameKana}`.toLowerCase().includes(keyword) ||
                employee.employeeNumber.toLowerCase().includes(keyword),
        );
    }
}
