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
import { StandardMonthlyRewardService } from '../services/standard-monthly-reward.service';

export type InsurancePremiumListRow = {
    employee: Employee;
    reward: StandardMonthlyReward | null;
    isRegistered: boolean;
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

    isLoading = signal(false);
    errorMessage = signal('');

    employees = signal<Employee[]>([]);
    officeNameById = signal<Record<string, string>>({});
    rewardsByEmployeeId = signal<Record<string, StandardMonthlyReward>>({});

    targetYearMonth = signal(this.currentYearMonth());

    targetYearMonthLabel = computed(() => this.formatYearMonth(this.targetYearMonth()));

    registeredRows = computed(() =>
        this.buildRows().filter((row) => row.isRegistered),
    );

    unregisteredRows = computed(() =>
        this.buildRows().filter((row) => !row.isRegistered),
    );

    async ngOnInit() {
        await this.loadPage();
    }

    async onTargetYearMonthChange() {
        await this.loadRewardsForMonth();
    }

    async shiftMonth(delta: number) {
        this.targetYearMonth.set(this.addMonths(this.targetYearMonth(), delta));
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

            await this.loadRewardsForMonth();
        } catch (e) {
            console.error('保険料計算画面の取得に失敗しました', e);
            this.errorMessage.set('データの取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    private async loadRewardsForMonth() {
        const ym = this.targetYearMonth();
        if (!ym) return;

        const rewards = await this.rewardService.listByTargetYearMonth(ym);
        const employeeIds = new Set(this.employees().map((e) => e.id));
        const byId: Record<string, StandardMonthlyReward> = {};
        for (const reward of rewards) {
            if (employeeIds.has(reward.employeeId)) {
                byId[reward.employeeId] = reward;
            }
        }
        this.rewardsByEmployeeId.set(byId);
    }

    private buildRows(): InsurancePremiumListRow[] {
        const byId = this.rewardsByEmployeeId();
        return this.employees().map((employee) => {
            const reward = byId[employee.id] ?? null;
            return {
                employee,
                reward,
                isRegistered: reward !== null,
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

    private addMonths(ym: string, delta: number): string {
        const [y, m] = ym.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    private formatYearMonth(ym: string): string {
        const [y, m] = ym.split('-');
        return `${y}年${Number(m)}月`;
    }
}
