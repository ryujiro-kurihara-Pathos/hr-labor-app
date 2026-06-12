import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { OfficeService } from '../../company/services/office.service';
import { SocialInsuranceStatusService } from '../services/social-insurance-status.service';
import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import {
    insuranceJoinStatus,
    SocialInsuranceStatus,
} from '../models/social-insurance-status.model';
import {
    formatInsuranceDate,
    InsuranceJoinKind,
    insuranceJoinStatusListLabel,
    isInsuranceEnrolled,
    isUnsetInsuranceStatus,
    memoPreview,
} from '../utils/social-insurance-status-display.util';
import { needsPartTimeInsuranceJudgmentWarning } from '../utils/part-time-insurance-judgment.util';

export type SocialInsuranceStatusListRow = {
    employee: Employee;
    status: SocialInsuranceStatus | null;
};

type StatusFilter = '' | insuranceJoinStatus;

@Component({
    selector: 'app-social-insurance-status-page',
    standalone: true,
    imports: [RouterLink, FormsModule],
    templateUrl: './social-insurance-status-page.component.html',
})
export class SocialInsuranceStatusPageComponent {
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly statusService = inject(SocialInsuranceStatusService);
    private readonly procedureService = inject(SocialInsuranceProcedureService);

    readonly formatInsuranceDate = formatInsuranceDate;
    readonly memoPreview = memoPreview;

    isLoading = signal(false);
    errorMessage = signal('');

    employees = signal<Employee[]>([]);
    statusByEmployeeId = signal<Record<string, SocialInsuranceStatus>>({});
    officeNameById = signal<Record<string, string>>({});
    /** 資格取得手続きを提出済み（完了）の従業員ID */
    submittedQualificationEmployeeIds = signal<Set<string>>(new Set());

    keyword = signal('');
    selectedOfficeId = signal('');
    healthFilter = signal<StatusFilter>('');
    pensionFilter = signal<StatusFilter>('');
    careFilter = signal<StatusFilter>('');
    unsetOnly = signal(false);

    officeOptions = computed(() => {
        const map = this.officeNameById();
        return Object.entries(map)
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    });

    rows = computed((): SocialInsuranceStatusListRow[] =>
        this.employees().map((employee) => ({
            employee,
            status: this.statusByEmployeeId()[employee.id] ?? null,
        })),
    );

    filteredRows = computed(() => this.filterRows());

    unsetCount = computed(
        () => this.rows().filter((row) => isUnsetInsuranceStatus(row.status)).length,
    );

    hasActiveFilters = computed(
        () =>
            Boolean(
                this.keyword().trim() ||
                    this.selectedOfficeId() ||
                    this.healthFilter() ||
                    this.pensionFilter() ||
                    this.careFilter() ||
                    this.unsetOnly(),
            ),
    );

    async ngOnInit() {
        await this.loadPage();
    }

    private async loadPage() {
        this.isLoading.set(true);
        this.errorMessage.set('');

        try {
            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) return;

            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (!appUser) {
                this.errorMessage.set('ユーザー情報の取得に失敗しました');
                return;
            }

            const [employees, offices] = await Promise.all([
                this.employeeService.getEmployeesByCompanyId(appUser.companyId),
                this.officeService.getOfficesByCompanyId(appUser.companyId),
            ]);
            this.employees.set(employees);

            const officeMap: Record<string, string> = {};
            for (const office of offices) {
                officeMap[office.id] = office.name;
            }
            this.officeNameById.set(officeMap);

            const [statuses, qualificationProcedures] = await Promise.all([
                this.statusService.listByEmployeeIds(employees.map((employee) => employee.id)),
                this.procedureService.listQualificationProceduresByCompanyId(appUser.companyId),
            ]);
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
            console.error('社会保険加入状況の取得に失敗しました', error);
            this.errorMessage.set('データの取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    statusForRow(row: SocialInsuranceStatusListRow, kind: InsuranceJoinKind): insuranceJoinStatus {
        const status = row.status;
        if (!status) return 'unknown';
        if (kind === 'health') return status.healthInsuranceStatus;
        if (kind === 'pension') return status.pensionInsuranceStatus;
        return status.careInsuranceStatus;
    }

    joinStatusLabelForRow(row: SocialInsuranceStatusListRow, kind: InsuranceJoinKind): string {
        const qualificationSubmitted = this.submittedQualificationEmployeeIds().has(row.employee.id);
        return insuranceJoinStatusListLabel(
            this.statusForRow(row, kind),
            kind,
            row.status,
            qualificationSubmitted,
        );
    }

    isEnrolledForRow(row: SocialInsuranceStatusListRow, kind: InsuranceJoinKind): boolean {
        const qualificationSubmitted = this.submittedQualificationEmployeeIds().has(row.employee.id);
        return isInsuranceEnrolled(
            this.statusForRow(row, kind),
            kind,
            row.status,
            qualificationSubmitted,
        );
    }

    employeeDetailLink(employeeId: string): string[] {
        return ['/employees', employeeId];
    }

    employeeDetailFragment(): string {
        return 'social-insurance';
    }

    needsLaborConditionWarning(row: SocialInsuranceStatusListRow): boolean {
        return needsPartTimeInsuranceJudgmentWarning(row.employee.employmentType, row.status);
    }

    laborConditionWarningCount = computed(
        () => this.rows().filter((row) => this.needsLaborConditionWarning(row)).length,
    );

    private filterRows(): SocialInsuranceStatusListRow[] {
        const keyword = this.keyword().trim().toLowerCase();
        const officeId = this.selectedOfficeId();
        const health = this.healthFilter();
        const pension = this.pensionFilter();
        const care = this.careFilter();
        const unsetOnly = this.unsetOnly();

        return this.rows().filter((row) => {
            if (officeId && row.employee.officeId !== officeId) return false;
            if (unsetOnly && !isUnsetInsuranceStatus(row.status)) return false;
            if (health && this.statusForRow(row, 'health') !== health) return false;
            if (pension && this.statusForRow(row, 'pension') !== pension) return false;
            if (care && this.statusForRow(row, 'care') !== care) return false;
            if (!keyword) return true;

            const employee = row.employee;
            return (
                `${employee.lastName}${employee.firstName}`.toLowerCase().includes(keyword) ||
                `${employee.lastNameKana}${employee.firstNameKana}`.toLowerCase().includes(keyword) ||
                employee.employeeNumber.toLowerCase().includes(keyword)
            );
        });
    }
}
