import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { OfficeService } from '../../company/services/office.service';
import { SocialInsuranceStatus } from '../../social-insurance/models/social-insurance-status.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { StandardMonthlyRewardService } from '../services/standard-monthly-reward.service';
import { StandardRemunerationDeterminationService } from '../services/standard-remuneration-determination.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { addMonthsToYearMonth, isRewardTargetMonth } from '../utils/reward-target-month.util';
import { isRewardConfirmed } from '../utils/reward-status.util';

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
    imports: [RouterLink, FormsModule, DecimalPipe],
    templateUrl: './reward-input-page.component.html',
})
export class RewardInputPageComponent {
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly bonusRewardService = inject(BonusRewardService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);

    isLoading = signal(false);
    errorMessage = signal('');

    employees = signal<Employee[]>([]);
    officeNameById = signal<Record<string, string>>({});
    rewardsByEmployeeId = signal<Record<string, Record<string, StandardMonthlyReward>>>({});
    bonusesByEmployeeId = signal<Record<string, BonusReward[]>>({});
    socialInsuranceByEmployeeId = signal<Record<string, SocialInsuranceStatus | null>>({});

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

            const nameMap: Record<string, string> = {};
            for (const office of offices) {
                nameMap[office.id] = office.name;
            }
            this.officeNameById.set(nameMap);

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
        const payYearMonth = this.targetYearMonth();
        return this.employees().map((employee) => {
            const employeeRewards = byEmployee[employee.id] ?? {};
            const reward = employeeRewards[payYearMonth] ?? null;
            const isTargetMonth = isRewardTargetMonth(employee, payYearMonth);
            const socialInsurance = socialInsuranceByEmployee[employee.id] ?? null;
            const effective = this.determinationService.resolve(
                employee,
                employeeRewards,
                payYearMonth,
                socialInsurance?.healthInsuranceStartDate ?? null,
                bonusesByEmployee[employee.id] ?? [],
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
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    private formatYearMonth(ym: string): string {
        const [y, m] = ym.split('-');
        return `${y}年${Number(m)}月`;
    }
}
