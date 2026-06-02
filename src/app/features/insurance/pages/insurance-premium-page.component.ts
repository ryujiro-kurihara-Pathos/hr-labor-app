import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { OfficeService } from '../../company/services/office.service';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { StandardMonthlyRewardService } from '../services/standard-monthly-reward.service';
import { StandardRemunerationDeterminationService } from '../services/standard-remuneration-determination.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { addMonthsToYearMonth, isRewardTargetMonth } from '../utils/reward-target-month.util';

export type InsurancePremiumListRow = {
    employee: Employee;
    reward: StandardMonthlyReward | null;
    effective: EffectiveStandardRemuneration;
    /** 対象年月の月次報酬が入力済みか */
    isRegistered: boolean;
    isTargetMonth: boolean;
};

@Component({
    selector: 'app-insurance-premium-page',
    standalone: true,
    imports: [RouterLink, FormsModule, DecimalPipe],
    templateUrl: './insurance-premium-page.component.html',
})
export class InsurancePremiumPageComponent {
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);

    isLoading = signal(false);
    errorMessage = signal('');

    employees = signal<Employee[]>([]);
    officeNameById = signal<Record<string, string>>({});
    rewardsByEmployeeId = signal<Record<string, Record<string, StandardMonthlyReward>>>({});
    healthInsuranceStartDateByEmployeeId = signal<Record<string, string | null>>({});

    targetYearMonth = signal(this.currentYearMonth());

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

    async ngOnInit() {
        await this.loadPage();
    }

    async onTargetYearMonthChange() {
        await this.loadRewardsForMonth();
    }

    async shiftMonth(delta: number) {
        this.targetYearMonth.set(addMonthsToYearMonth(this.targetYearMonth(), delta));
        await this.loadRewardsForMonth();
    }

    private async loadPage() {
        this.isLoading.set(true);
        this.errorMessage.set('');
        try {
            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) return;
            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (!appUser) return;

            const [employees, offices] = await Promise.all([
                this.employeeService.getEmployeesByCompanyId(appUser.companyId),
                this.officeService.getOfficesByCompanyId(appUser.companyId),
            ]);
            this.employees.set(employees);

            const map: Record<string, string> = {};
            for (const office of offices) {
                map[office.id] = office.name;
            }
            this.officeNameById.set(map);

            await this.loadHealthInsuranceStartDates(employees);
            await this.loadRewardsForMonth();
        } catch (e) {
            console.error('保険料計算画面の取得に失敗しました', e);
            this.errorMessage.set('データの取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    private async loadRewardsForMonth() {
        const employees = this.employees();
        if (employees.length === 0) {
            this.rewardsByEmployeeId.set({});
            return;
        }

        const rewardLists = await Promise.all(
            employees.map((employee) => this.rewardService.listByEmployee(employee.id)),
        );

        const byEmployee: Record<string, Record<string, StandardMonthlyReward>> = {};
        for (let i = 0; i < employees.length; i++) {
            const map: Record<string, StandardMonthlyReward> = {};
            for (const reward of rewardLists[i]) {
                map[reward.targetYearMonth] = reward;
            }
            byEmployee[employees[i].id] = map;
        }
        this.rewardsByEmployeeId.set(byEmployee);
    }

    private async loadHealthInsuranceStartDates(employees: Employee[]) {
        const entries = await Promise.all(
            employees.map(async (employee) => {
                const status = await this.socialInsuranceStatusService.getByEmployeeId(employee.id);
                return [employee.id, status?.healthInsuranceStartDate ?? null] as const;
            }),
        );
        this.healthInsuranceStartDateByEmployeeId.set(Object.fromEntries(entries));
    }

    private buildRows(): InsurancePremiumListRow[] {
        const byEmployee = this.rewardsByEmployeeId();
        const ym = this.targetYearMonth();
        const healthDates = this.healthInsuranceStartDateByEmployeeId();
        return this.employees().map((employee) => {
            const employeeRewards = byEmployee[employee.id] ?? {};
            const reward = employeeRewards[ym] ?? null;
            const isTargetMonth = isRewardTargetMonth(employee, ym);
            const effective = this.determinationService.resolve(
                employee,
                employeeRewards,
                ym,
                healthDates[employee.id],
            );
            return {
                employee,
                reward,
                effective,
                isRegistered: reward !== null,
                isTargetMonth,
            };
        });
    }

    detailLink(employeeId: string): string[] {
        return ['/premium', employeeId];
    }

    detailQueryParams() {
        return { ym: this.targetYearMonth() };
    }

    private currentYearMonth(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    private formatYearMonth(ym: string): string {
        const [y, m] = ym.split('-');
        return `${y}年${Number(m)}月`;
    }
}
