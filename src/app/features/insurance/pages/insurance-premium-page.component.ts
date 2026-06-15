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
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { StandardMonthlyRewardService } from '../services/standard-monthly-reward.service';
import { StandardRemunerationDeterminationService } from '../services/standard-remuneration-determination.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { InsurancePremiumResultService } from '../services/insurance-premium-result.service';
import { InsurancePremiumResult } from '../models/insurance-premium-result.model';
import { addMonthsToYearMonth, isRewardTargetMonth } from '../utils/reward-target-month.util';
import { isRewardConfirmed } from '../utils/reward-status.util';

export type InsurancePremiumListRow = {
    employee: Employee;
    reward: StandardMonthlyReward | null;
    effective: EffectiveStandardRemuneration;
    /** 対象年月の月次報酬が入力済みか */
    isRegistered: boolean;
    isTargetMonth: boolean;
    premiumResult: InsurancePremiumResult | null;
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
    private readonly bonusRewardService = inject(BonusRewardService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly premiumResultService = inject(InsurancePremiumResultService);

    isLoading = signal(false);
    errorMessage = signal('');
    companyId = signal('');

    employees = signal<Employee[]>([]);
    officeNameById = signal<Record<string, string>>({});
    rewardsByEmployeeId = signal<Record<string, Record<string, StandardMonthlyReward>>>({});
    bonusesByEmployeeId = signal<Record<string, BonusReward[]>>({});
    healthInsuranceStartDateByEmployeeId = signal<Record<string, string | null>>({});
    premiumResultsByEmployeeId = signal<Record<string, InsurancePremiumResult>>({});

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

    savedPremiumRows = computed(() =>
        this.buildRows().filter((row) => row.isTargetMonth && row.premiumResult !== null),
    );

    companyEmployerPremiumTotal = computed(() =>
        this.premiumResultService.sumEmployerPremium(
            this.savedPremiumRows().map((row) => row.premiumResult!),
        ),
    );

    /** 会社負担合計に含めた従業員数（保存済み保険料がある行） */
    calculableEmployerPremiumRowCount = computed(() => this.savedPremiumRows().length);

    unsavedTargetRowCount = computed(() =>
        this.buildRows().filter((row) => row.isTargetMonth && row.premiumResult === null).length,
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
            this.companyId.set(appUser.companyId);

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
            this.bonusesByEmployeeId.set({});
            this.premiumResultsByEmployeeId.set({});
            return;
        }

        const companyId = this.companyId();
        const targetYearMonth = this.targetYearMonth();
        const [rewardLists, bonusLists, premiumResults] = await Promise.all([
            Promise.all(employees.map((employee) => this.rewardService.listByEmployee(employee.id))),
            Promise.all(
                employees.map((employee) =>
                    this.bonusRewardService.getBonusRewardsByEmployee(
                        employee.companyId,
                        employee.id,
                    ),
                ),
            ),
            companyId
                ? this.premiumResultService.listByCompanyAndMonth(companyId, targetYearMonth)
                : Promise.resolve([]),
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

        const premiumByEmployee: Record<string, InsurancePremiumResult> = {};
        for (const result of premiumResults) {
            premiumByEmployee[result.employeeId] = result;
        }
        this.premiumResultsByEmployeeId.set(premiumByEmployee);
    }

    private async loadHealthInsuranceStartDates(employees: Employee[]) {
        const entries = await Promise.all(
            employees.map(async (employee) => {
                const status = await this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employee.id);
                return [employee.id, status?.healthInsuranceStartDate ?? null] as const;
            }),
        );
        this.healthInsuranceStartDateByEmployeeId.set(Object.fromEntries(entries));
    }

    private buildRows(): InsurancePremiumListRow[] {
        const byEmployee = this.rewardsByEmployeeId();
        const bonusesByEmployee = this.bonusesByEmployeeId();
        const premiumByEmployee = this.premiumResultsByEmployeeId();
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
                bonusesByEmployee[employee.id] ?? [],
            );
            return {
                employee,
                reward,
                effective,
                isRegistered: isRewardConfirmed(reward),
                isTargetMonth,
                premiumResult: premiumByEmployee[employee.id] ?? null,
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
