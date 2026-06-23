import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { OfficeService } from '../../company/services/office.service';
import { CompanyService } from '../../company/services/company.service';
import { Office } from '../../company/models/office.model';
import { SocialInsuranceStatus } from '../../social-insurance/models/social-insurance-status.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { StandardMonthlyRewardService } from '../services/standard-monthly-reward.service';
import { StandardRemunerationDeterminationService } from '../services/standard-remuneration-determination.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { MonthNavigationBarComponent } from '../../../shared/components/month-navigation-bar.component';
import {
    InsuranceListFilterBarComponent,
    InsuranceListStatusFilterOption,
} from '../../../shared/components/insurance-list-filter-bar.component';
import { addMonthsToYearMonth, currentYearMonth as getCurrentYearMonth, listNavigableYearMonthMax, listNavigableYearMonthMin } from '../utils/reward-target-month.util';
import { filterInsuranceListRows } from '../utils/employee-list-filter.util';
import { isRewardConfirmed } from '../utils/reward-status.util';
import {
    isSalaryPayMonthTarget,
    lookupExactRewardByPayMonth,
} from '../utils/reward-pay-month.util';
import { buildSocialInsuranceJoinJudgmentContext } from '../../social-insurance/utils/social-insurance-join-status.util';

export type RewardInputListRow = {
    employee: Employee;
    reward: StandardMonthlyReward | null;
    effective: EffectiveStandardRemuneration;
    isRegistered: boolean;
    isTargetMonth: boolean;
};

@Component({
    selector: 'app-reward-input-page',
    standalone: true,
    imports: [RouterLink, FormsModule, DecimalPipe, MonthNavigationBarComponent, InsuranceListFilterBarComponent],
    templateUrl: './reward-input-page.component.html',
})
export class RewardInputPageComponent {
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly companyService = inject(CompanyService);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly bonusRewardService = inject(BonusRewardService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);

    isLoading = signal(false);
    errorMessage = signal('');

    employees = signal<Employee[]>([]);
    officeById = signal<Record<string, Office>>({});
    officeNameById = signal<Record<string, string>>({});
    rewardsByEmployeeId = signal<Record<string, Record<string, StandardMonthlyReward>>>({});
    bonusesByEmployeeId = signal<Record<string, BonusReward[]>>({});
    socialInsuranceByEmployeeId = signal<Record<string, SocialInsuranceStatus | null>>({});
    payrollPaymentMonthOffset = signal<0 | 1>(1);

    keyword = signal('');
    selectedOfficeId = signal('');
    statusFilter = signal<'all' | 'unregistered' | 'registered'>('all');

    readonly rewardStatusFilterOptions: InsuranceListStatusFilterOption[] = [
        { value: 'all', label: 'すべて' },
        { value: 'unregistered', label: '未入力のみ', warn: true },
        { value: 'registered', label: '登録済みのみ' },
    ];

    /** 支給年月 */
    targetYearMonth = signal(getCurrentYearMonth());

    navigableMinYearMonth = computed(() =>
        listNavigableYearMonthMin(getCurrentYearMonth()),
    );

    navigableMaxYearMonth = computed(() =>
        listNavigableYearMonthMax(getCurrentYearMonth()),
    );

    canGoPrevMonth = computed(() => {
        const minYm = this.navigableMinYearMonth();
        return this.targetYearMonth() > minYm;
    });

    canGoNextMonth = computed(() => {
        const maxYm = this.navigableMaxYearMonth();
        return this.targetYearMonth() < maxYm;
    });

    targetYearMonthLabel = computed(() => this.formatYearMonth(this.targetYearMonth()));

    registeredRows = computed(() =>
        this.buildRows().filter((row) => row.isTargetMonth && row.isRegistered),
    );

    unregisteredRows = computed(() =>
        this.buildRows().filter((row) => row.isTargetMonth && !row.isRegistered),
    );

    excludedRowCount = computed(() =>
        this.buildRows().filter((row) => !row.isTargetMonth).length,
    );

    targetRowCount = computed(() =>
        this.buildRows().filter((row) => row.isTargetMonth).length,
    );

    registrationRate = computed(() => {
        const target = this.targetRowCount();
        if (target === 0) return 0;
        return Math.round((this.registeredRows().length / target) * 100);
    });

    officeOptions = computed(() =>
        Object.values(this.officeById()).sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    );

    hasActiveListFilters = computed(
        () => Boolean(this.keyword().trim() || this.selectedOfficeId() || this.statusFilter() !== 'all'),
    );

    filteredRegisteredRows = computed(() => this.applyListFilters(this.registeredRows()));

    filteredUnregisteredRows = computed(() => this.applyListFilters(this.unregisteredRows()));

    showRegisteredSection = computed(() => this.statusFilter() !== 'unregistered');

    showUnregisteredSection = computed(() => this.statusFilter() !== 'registered');

    filteredVisibleRowCount = computed(
        () => this.filteredRegisteredRows().length + this.filteredUnregisteredRows().length,
    );

    async ngOnInit() {
        await this.loadPage();
    }

    async onTargetYearMonthChange() {
        await this.loadRewardsForMonth();
    }

    async shiftMonth(delta: number) {
        if ((delta < 0 && !this.canGoPrevMonth()) || (delta > 0 && !this.canGoNextMonth())) {
            return;
        }
        this.targetYearMonth.set(addMonthsToYearMonth(this.targetYearMonth(), delta));
        await this.loadRewardsForMonth();
    }

    detailLink(employeeId: string): string[] {
        return ['/rewards', employeeId];
    }

    detailQueryParams() {
        return { ym: this.targetYearMonth() };
    }

    employeeInitial(employee: Employee): string {
        const initial = employee.lastName?.trim().charAt(0) || employee.firstName?.trim().charAt(0);
        return initial || '?';
    }

    employeeDisplayName(employee: Employee): string {
        return `${employee.lastName} ${employee.firstName}`.trim();
    }

    clearListFilters(): void {
        this.keyword.set('');
        this.selectedOfficeId.set('');
        this.statusFilter.set('all');
    }

    setStatusFilter(value: string): void {
        if (value === 'unregistered' || value === 'registered') {
            this.statusFilter.set(value);
            return;
        }
        this.statusFilter.set('all');
    }

    private applyListFilters<T extends RewardInputListRow>(rows: T[]): T[] {
        return filterInsuranceListRows(rows, {
            keyword: this.keyword(),
            officeId: this.selectedOfficeId(),
        });
    }

    private async loadPage() {
        this.isLoading.set(true);
        this.errorMessage.set('');
        try {
            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) return;
            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (!appUser) return;

            const [employees, offices, company] = await Promise.all([
                this.employeeService.getEmployeesByCompanyId(appUser.companyId),
                this.officeService.getOfficesByCompanyId(appUser.companyId),
                this.companyService.getCompanyById(appUser.companyId),
            ]);
            this.employees.set(employees);
            this.payrollPaymentMonthOffset.set(company?.payrollPaymentMonthOffset ?? 1);

            const nameMap: Record<string, string> = {};
            const officeMap: Record<string, Office> = {};
            for (const office of offices) {
                nameMap[office.id] = office.name;
                officeMap[office.id] = office;
            }
            this.officeNameById.set(nameMap);
            this.officeById.set(officeMap);

            await this.loadSocialInsuranceStatuses(employees);
            await this.loadRewardsForMonth();
        } catch (e) {
            console.error('報酬入力画面の取得に失敗しました', e);
            this.errorMessage.set('データの取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    private async loadRewardsForMonth() {
        const employees = this.employees();
        if (employees.length === 0) {
            this.rewardsByEmployeeId.set({});
            this.bonusesByEmployeeId.set({});
            return;
        }

        const [rewardLists, bonusLists] = await Promise.all([
            Promise.all(employees.map((employee) => this.rewardService.listByEmployee(employee.id))),
            Promise.all(
                employees.map((employee) =>
                    this.bonusRewardService.getBonusRewardsByEmployee(
                        employee.companyId,
                        employee.id,
                    ),
                ),
            ),
        ]);

        const byEmployee: Record<string, Record<string, StandardMonthlyReward>> = {};
        const bonusesByEmployee: Record<string, BonusReward[]> = {};
        for (let i = 0; i < employees.length; i++) {
            const map: Record<string, StandardMonthlyReward> = {};
            for (const reward of rewardLists[i]) {
                map[reward.targetYearMonth] = reward;
            }
            byEmployee[employees[i].id] = map;
            bonusesByEmployee[employees[i].id] = bonusLists[i];
        }
        this.rewardsByEmployeeId.set(byEmployee);
        this.bonusesByEmployeeId.set(bonusesByEmployee);
    }

    private async loadSocialInsuranceStatuses(employees: Employee[]) {
        const entries = await Promise.all(
            employees.map(async (employee) => {
                const status = await this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employee.id);
                return [employee.id, status] as const;
            }),
        );
        this.socialInsuranceByEmployeeId.set(Object.fromEntries(entries));
    }

    private buildRows(): RewardInputListRow[] {
        const byEmployee = this.rewardsByEmployeeId();
        const bonusesByEmployee = this.bonusesByEmployeeId();
        const socialInsuranceByEmployee = this.socialInsuranceByEmployeeId();
        const officeById = this.officeById();
        const payYearMonth = this.targetYearMonth();
        const offset = this.payrollPaymentMonthOffset();
        return this.employees().map((employee) => {
            const employeeRewards = byEmployee[employee.id] ?? {};
            const reward = lookupExactRewardByPayMonth(employeeRewards, payYearMonth);
            const isTargetMonth = isSalaryPayMonthTarget(employee, payYearMonth, offset);
            const socialInsurance = socialInsuranceByEmployee[employee.id] ?? null;
            const joinJudgmentContext = buildSocialInsuranceJoinJudgmentContext(
                employee,
                socialInsurance,
                officeById[employee.officeId] ?? null,
            );
            const effective = this.determinationService.resolve(
                employee,
                employeeRewards,
                payYearMonth,
                socialInsurance?.healthInsuranceStartDate ?? null,
                bonusesByEmployee[employee.id] ?? [],
                offset,
                [],
                joinJudgmentContext,
            );
            return {
                employee,
                reward,
                effective,
                isRegistered: isRewardConfirmed(reward),
                isTargetMonth,
            };
        });
    }

    private currentYearMonth(): string {
        return getCurrentYearMonth();
    }

    private formatYearMonth(ym: string): string {
        const [y, m] = ym.split('-');
        return `${y}年${Number(m)}月`;
    }
}
