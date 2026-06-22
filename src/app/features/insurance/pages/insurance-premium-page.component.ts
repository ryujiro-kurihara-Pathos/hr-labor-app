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
import { Company, InsurancePremiumCollectionTiming } from '../../company/models/company.model';
import { Office } from '../../company/models/office.model';
import { SocialInsuranceStatus } from '../../social-insurance/models/social-insurance-status.model';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { StandardMonthlyRewardService } from '../services/standard-monthly-reward.service';
import { StandardRemunerationDeterminationService } from '../services/standard-remuneration-determination.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { InsurancePremiumCalculationService, CalculatedInsurancePremium } from '../services/insurance-premium-calculation.service';
import { ManualInsurancePremiumRateService } from '../services/manual-insurance-premium-rate.service';
import { ManualInsurancePremiumRates } from '../models/manual-insurance-premium-rate.model';
import { resolvePremiumLiabilityYearMonth, resolvePremiumStandardDeterminationYearMonth } from '../../company/utils/company-payroll-settings.util';
import { addMonthsToYearMonth, isPremiumViewableYearMonth } from '../utils/reward-target-month.util';
import {
    findLatestConfirmedPayYearMonth,
    lookupPremiumBasisReward,
    resolvePremiumBasisRewardPayYearMonth,
} from '../utils/reward-pay-month.util';
import { isRewardConfirmed } from '../utils/reward-status.util';
import { exportInsurancePremiumCsv } from '../utils/insurance-premium-csv-export.util';
import { buildSocialInsuranceJoinJudgmentContext } from '../../social-insurance/utils/social-insurance-join-status.util';

export type InsurancePremiumListRow = {
    employee: Employee;
    reward: StandardMonthlyReward | null;
    effective: EffectiveStandardRemuneration;
    /** 対象年月の月次報酬が入力済みか */
    isRegistered: boolean;
    isTargetMonth: boolean;
    calculatedPremium: CalculatedInsurancePremium | null;
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
    private readonly companyService = inject(CompanyService);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly bonusRewardService = inject(BonusRewardService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly premiumCalculationService = inject(InsurancePremiumCalculationService);
    private readonly manualRateService = inject(ManualInsurancePremiumRateService);

    isLoading = signal(false);
    errorMessage = signal('');
    csvExportMessage = signal('');
    companyId = signal('');

    employees = signal<Employee[]>([]);
    officeById = signal<Record<string, Office>>({});
    officeNameById = signal<Record<string, string>>({});
    rewardsByEmployeeId = signal<Record<string, Record<string, StandardMonthlyReward>>>({});
    bonusesByEmployeeId = signal<Record<string, BonusReward[]>>({});
    socialInsuranceByEmployeeId = signal<Record<string, SocialInsuranceStatus | null>>({});
    manualRatesByEmployeeId = signal<Record<string, ManualInsurancePremiumRates>>({});
    insurancePremiumCollectionTiming = signal<InsurancePremiumCollectionTiming>('next_month');
    payrollPaymentMonthOffset = signal<0 | 1>(1);

    targetYearMonth = signal(this.currentYearMonth());

    targetYearMonthLabel = computed(() => this.formatYearMonth(this.targetYearMonth()));

    /** 報酬入力リンク先の支給年月（翌月徴収時は保険料対象月＝給与控除月の前月） */
    rewardInputYearMonthForPremiumBasis = computed((): string =>
        resolvePremiumBasisRewardPayYearMonth(
            this.targetYearMonth(),
            this.insurancePremiumCollectionTiming(),
        ),
    );

    registeredRows = computed(() =>
        this.buildRows().filter((row) => row.isTargetMonth && row.isRegistered),
    );

    unregisteredRows = computed(() =>
        this.buildRows().filter((row) => row.isTargetMonth && !row.isRegistered),
    );

    excludedRowCount = computed(() =>
        this.buildRows().filter((row) => !row.isTargetMonth).length,
    );

    calculablePremiumRows = computed(() =>
        this.buildRows().filter((row) => row.isTargetMonth && row.calculatedPremium !== null),
    );

    companyEmployerPremiumTotal = computed(() =>
        this.calculablePremiumRows().reduce(
            (sum, row) => sum + (row.calculatedPremium?.totalEmployerPremium ?? 0),
            0,
        ),
    );

    /** 会社負担合計に含めた従業員数 */
    calculableEmployerPremiumRowCount = computed(() => this.calculablePremiumRows().length);

    uncalculableTargetRowCount = computed(() =>
        this.buildRows().filter((row) => row.isTargetMonth && row.calculatedPremium === null).length,
    );

    async ngOnInit() {
        await this.loadPage();
    }

    async onTargetYearMonthChange() {
        this.csvExportMessage.set('');
        await this.loadRewardsForMonth();
    }

    async shiftMonth(delta: number) {
        this.csvExportMessage.set('');
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

            const [employees, offices, company] = await Promise.all([
                this.employeeService.getEmployeesByCompanyId(appUser.companyId),
                this.officeService.getOfficesByCompanyId(appUser.companyId),
                this.companyService.getCompanyById(appUser.companyId),
            ]);
            this.employees.set(employees);
            this.insurancePremiumCollectionTiming.set(
                company?.insurancePremiumCollectionTiming ?? 'next_month',
            );
            this.payrollPaymentMonthOffset.set(company?.payrollPaymentMonthOffset ?? 1);

            const officeMap: Record<string, Office> = {};
            const nameMap: Record<string, string> = {};
            for (const office of offices) {
                officeMap[office.id] = office;
                nameMap[office.id] = office.name;
            }
            this.officeById.set(officeMap);
            this.officeNameById.set(nameMap);

            await this.loadSocialInsuranceStatuses(employees);
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
            this.manualRatesByEmployeeId.set({});
            return;
        }

        const targetYearMonth = this.targetYearMonth();
        const companyId = this.companyId();
        const liabilityYearMonth = resolvePremiumLiabilityYearMonth(
            targetYearMonth,
            this.insurancePremiumCollectionTiming(),
        );
        const [rewardLists, bonusLists, manualRates] = await Promise.all([
            Promise.all(employees.map((employee) => this.rewardService.listByEmployee(employee.id))),
            Promise.all(
                employees.map((employee) =>
                    this.bonusRewardService.getBonusRewardsByEmployee(
                        employee.companyId,
                        employee.id,
                    ),
                ),
            ),
            liabilityYearMonth && companyId
                ? this.manualRateService.listByCompanyAndLiabilityMonth(companyId, liabilityYearMonth)
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
        this.manualRatesByEmployeeId.set(
            Object.fromEntries(manualRates.map((rate) => [rate.employeeId, rate])),
        );
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

    private buildRows(): InsurancePremiumListRow[] {
        const byEmployee = this.rewardsByEmployeeId();
        const bonusesByEmployee = this.bonusesByEmployeeId();
        const socialInsuranceByEmployee = this.socialInsuranceByEmployeeId();
        const officeById = this.officeById();
        const payYearMonth = this.targetYearMonth();
        const collectionTiming = this.insurancePremiumCollectionTiming();
        const manualRatesByEmployee = this.manualRatesByEmployeeId();
        const offset = this.payrollPaymentMonthOffset();
        return this.employees().map((employee) => {
            const employeeRewards = byEmployee[employee.id] ?? {};
            const liabilityYearMonth = resolvePremiumLiabilityYearMonth(payYearMonth, collectionTiming) ?? payYearMonth;
            const reward = lookupPremiumBasisReward(employeeRewards, payYearMonth, collectionTiming);
            const latestConfirmedWorkYearMonth = findLatestConfirmedPayYearMonth(employeeRewards, offset);
            const isTargetMonth = isPremiumViewableYearMonth(
                employee,
                payYearMonth,
                this.currentYearMonth(),
                collectionTiming,
                latestConfirmedWorkYearMonth,
            );
            const socialInsurance = socialInsuranceByEmployee[employee.id] ?? null;
            const joinJudgmentContext = buildSocialInsuranceJoinJudgmentContext(
                employee,
                socialInsurance,
                officeById[employee.officeId] ?? null,
            );
            const effective = this.determinationService.resolve(
                employee,
                employeeRewards,
                resolvePremiumStandardDeterminationYearMonth(liabilityYearMonth, collectionTiming),
                socialInsurance?.healthInsuranceStartDate ?? null,
                bonusesByEmployee[employee.id] ?? [],
                offset,
                [],
                joinJudgmentContext,
            );
            const calculatedPremium = isTargetMonth
                ? this.premiumCalculationService.calculateForPayMonth({
                    employee,
                    payYearMonth,
                    collectionTiming,
                    rewardsByYearMonth: employeeRewards,
                    bonuses: bonusesByEmployee[employee.id] ?? [],
                    healthInsuranceStartDate: socialInsurance?.healthInsuranceStartDate ?? null,
                    healthInsuranceEndDate: socialInsurance?.healthInsuranceEndDate ?? null,
                    pensionInsuranceStartDate: socialInsurance?.pensionInsuranceStartDate ?? null,
                    pensionInsuranceEndDate: socialInsurance?.pensionInsuranceEndDate ?? null,
                    office: officeById[employee.officeId] ?? null,
                    manualRates: manualRatesByEmployee[employee.id] ?? null,
                    joinJudgmentContext,
                })
                : null;
            return {
                employee,
                reward,
                effective,
                isRegistered: isRewardConfirmed(reward),
                isTargetMonth,
                calculatedPremium,
            };
        });
    }

    detailLink(employeeId: string): string[] {
        return ['/premium', employeeId];
    }

    detailQueryParams() {
        return { ym: this.targetYearMonth() };
    }

    exportCsv() {
        this.csvExportMessage.set('');
        const items = this.calculablePremiumRows().map((row) => ({
            employee: row.employee,
            officeName: this.officeNameById()[row.employee.officeId] ?? '—',
            payYearMonth: this.targetYearMonth(),
            premium: row.calculatedPremium!,
        }));

        const result = exportInsurancePremiumCsv({
            items,
            collectionTiming: this.insurancePremiumCollectionTiming(),
            payYearMonth: this.targetYearMonth(),
        });

        if (!result.ok) {
            this.csvExportMessage.set(result.error);
            return;
        }

        this.csvExportMessage.set(`${this.targetYearMonthLabel()}の保険料計算結果をCSVで出力しました（${items.length}名）`);
    }

    employeeInitial(employee: Employee): string {
        const initial = employee.lastName?.trim().charAt(0) || employee.firstName?.trim().charAt(0);
        return initial || '?';
    }

    employeeDisplayName(employee: Employee): string {
        return `${employee.lastName} ${employee.firstName}`.trim();
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
