import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { Employee } from '../../employee/models/employee.models';
import { EmployeeService } from '../../employee/services/employee.service';
import { Office } from '../../company/models/office.model';
import { Company, InsurancePremiumCollectionTiming } from '../../company/models/company.model';
import { CompanyService } from '../../company/services/company.service';
import { formatPayrollDeductionNote } from '../../company/utils/company-payroll-settings.util';
import { OfficeService } from '../../company/services/office.service';
import { SocialInsuranceStatus } from '../../social-insurance/models/social-insurance-status.model';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { StandardMonthlyReward } from '../models/standard-monthly-reward.model';
import { StandardMonthlyRewardService } from '../services/standard-monthly-reward.service';
import { StandardRemunerationDeterminationService } from '../services/standard-remuneration-determination.service';
import { EffectiveStandardRemuneration } from '../models/standard-remuneration-determination.model';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import {
    addMonthsToYearMonth,
    clampViewableYearMonth,
    isViewableYearMonth,
    listViewableYearMonths,
    viewableYearMonthMax,
    viewableYearMonthMin,
    viewableYearMonthReason,
} from '../utils/reward-target-month.util';
import {
    confirmedRewardsByYearMonth,
    isRewardConfirmed,
} from '../utils/reward-status.util';
import {
    bonusesForStandardBonusPremium,
    shouldTreatBonusAsMonthlyRemuneration,
} from '../utils/effective-monthly-reward.util';
import {
    formatYearMonthLabel,
    formatYearMonthList,
} from '../utils/standard-remuneration-determination.util';
import { findCareInsuranceRate, findHealthInsuranceRate } from '../../insurance-rate/utils/insurance-rate-lookup.util';
import { KYOKAI_HEALTH_INSURANCE_RATE_FILES } from '../../insurance-rate/data/insurance-rates';
import { InsuranceRateRow } from '../../insurance-rate/models/insurance-rate.model';
import { roundInsurancePremium } from '../utils/insurance-premium-rounding.util';
import { insuranceJoinStatusLabel } from '../../social-insurance/utils/social-insurance-status-display.util';
import {
    computeCareInsurancePeriod,
    isCareInsurancePremiumTargetMonth,
    judgeCareInsuranceStatus,
} from '../../social-insurance/utils/care-insurance-period.util';
import { isInsurancePremiumTargetMonth } from '../../social-insurance/utils/insurance-premium-period.util';

const PENSION_RATE = 0.0915;

type RewardField = {
    label: string;
    value: number;
};

@Component({
    selector: 'app-my-insurance-premium',
    standalone: true,
    imports: [FormsModule, DecimalPipe],
    templateUrl: './my-insurance-premium-page.component.html',
})
export class MyInsurancePremiumPageComponent implements OnInit {
    readonly pensionRate = PENSION_RATE;

    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly companyService = inject(CompanyService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly bonusRewardService = inject(BonusRewardService);
    private readonly router = inject(Router);

    employee = signal<Employee | null>(null);
    office = signal<Office | null>(null);
    company = signal<Company | null>(null);
    insurancePremiumCollectionTiming = signal<InsurancePremiumCollectionTiming>('next_month');
    insuranceStatus = signal<SocialInsuranceStatus | null>(null);
    standardReward = signal<StandardMonthlyReward | null>(null);
    allRewards = signal<StandardMonthlyReward[]>([]);
    effectiveStandard = signal<EffectiveStandardRemuneration | null>(null);
    monthBonuses = signal<BonusReward[]>([]);
    allBonuses = signal<BonusReward[]>([]);
    healthRateRow = signal<InsuranceRateRow | null>(null);
    careRateRow = signal<InsuranceRateRow | null>(null);

    targetYearMonth = signal(this.currentYearMonth());
    isLoading = signal(true);
    isLoadingMonth = signal(false);
    errorMessage = signal('');

    targetYearMonthLabel = computed(() => formatYearMonthLabel(this.targetYearMonth()));

    payrollDeductionNote = computed(() => {
        const targetYearMonth = this.targetYearMonth();
        if (!targetYearMonth) return '';
        return formatPayrollDeductionNote(targetYearMonth, this.insurancePremiumCollectionTiming());
    });

    viewableMinYearMonth = computed(() => {
        const employee = this.employee();
        return employee ? viewableYearMonthMin(employee) : null;
    });

    viewableMaxYearMonth = computed(() => {
        const employee = this.employee();
        return employee ? viewableYearMonthMax(employee, this.currentYearMonth()) : null;
    });

    viewablePeriodLabel = computed(() => {
        const minYm = this.viewableMinYearMonth();
        const maxYm = this.viewableMaxYearMonth();
        if (!minYm || !maxYm) return null;
        return `${formatYearMonthLabel(minYm)}〜${formatYearMonthLabel(maxYm)}`;
    });

    isViewableMonth = computed(() => {
        const employee = this.employee();
        const ym = this.targetYearMonth();
        return Boolean(employee && ym && isViewableYearMonth(employee, ym, this.currentYearMonth()));
    });

    canGoPrevMonth = computed(() => {
        const minYm = this.viewableMinYearMonth();
        const ym = this.targetYearMonth();
        return Boolean(minYm && ym && ym > minYm);
    });

    canGoNextMonth = computed(() => {
        const maxYm = this.viewableMaxYearMonth();
        const ym = this.targetYearMonth();
        return Boolean(maxYm && ym && ym < maxYm);
    });

    viewableMonthReason = computed(() => {
        const employee = this.employee();
        const ym = this.targetYearMonth();
        if (!employee || !ym) return null;
        return viewableYearMonthReason(employee, ym, this.currentYearMonth());
    });

    unconfirmedMonthsInRange = computed(() => {
        const employee = this.employee();
        if (!employee) return [];

        const rewardsByYearMonth = Object.fromEntries(
            this.allRewards().map((reward) => [reward.targetYearMonth, reward]),
        );

        return listViewableYearMonths(employee, this.currentYearMonth()).filter(
            (yearMonth) => !isRewardConfirmed(rewardsByYearMonth[yearMonth]),
        );
    });

    unconfirmedMonthsLabel = computed(() => {
        const months = this.unconfirmedMonthsInRange();
        if (months.length === 0) return null;
        return formatYearMonthList(months);
    });

    treatBonusAsMonthlyRemuneration = computed(() => {
        const ym = this.targetYearMonth();
        if (!ym) return false;
        return shouldTreatBonusAsMonthlyRemuneration(this.allBonuses(), ym);
    });

    bonusesForPremium = computed(() => {
        const ym = this.targetYearMonth();
        if (!ym) return [];
        return bonusesForStandardBonusPremium(this.monthBonuses(), ym, this.allBonuses());
    });

    standardAmount = computed((): number | null => {
        const effective = this.effectiveStandard();
        if (!effective?.isComplete || !effective.calculation?.health) return null;
        return effective.calculation.health.standardMonthlyAmount;
    });

    healthGrade = computed((): number | null => {
        return this.effectiveStandard()?.calculation?.health?.grade ?? null;
    });

    pensionGrade = computed((): number | null => {
        return this.effectiveStandard()?.calculation?.pension?.grade ?? null;
    });

    isHealthPremiumMonth = computed(() => {
        const status = this.insuranceStatus();
        const ym = this.targetYearMonth();
        if (!status || !ym) return false;
        return isInsurancePremiumTargetMonth(
            ym,
            status.healthInsuranceStartDate,
            status.healthInsuranceEndDate,
        );
    });

    healthPremium = computed(() => {
        if (!this.isHealthPremiumMonth()) return null;
        return this.calculatePremium(this.standardAmount(), this.healthRateRow()?.employeeRate ?? null);
    });

    pensionPremium = computed(() => {
        if (!this.isHealthPremiumMonth()) return null;
        return this.calculatePremium(this.standardAmount(), PENSION_RATE);
    });

    isCarePremiumMonth = computed(() => {
        const status = this.insuranceStatus();
        const employee = this.employee();
        const ym = this.targetYearMonth();
        if (!status || !employee || !ym) return false;
        return isCareInsurancePremiumTargetMonth(
            ym,
            status.healthInsuranceStartDate,
            status.healthInsuranceEndDate,
            employee.birthDate,
        );
    });

    careInsurancePeriod = computed(() => {
        const status = this.insuranceStatus();
        const employee = this.employee();
        return computeCareInsurancePeriod(
            status?.healthInsuranceStartDate,
            status?.healthInsuranceEndDate,
            employee?.birthDate ?? null,
        );
    });

    carePremium = computed(() => {
        if (!this.isCarePremiumMonth()) return null;
        return this.calculatePremium(this.standardAmount(), this.careRateRow()?.employeeRate ?? null);
    });

    monthlySocialInsurancePremium = computed((): number | null => {
        const parts = [this.healthPremium(), this.pensionPremium(), this.carePremium()];
        if (parts.every((value) => value === null)) return null;
        return (this.healthPremium() ?? 0) + (this.pensionPremium() ?? 0) + (this.carePremium() ?? 0);
    });

    bonusSocialInsurancePremium = computed((): number | null => {
        const bonuses = this.bonusesForPremium();
        if (bonuses.length === 0) return null;

        let total = 0;
        let hasValue = false;
        for (const bonus of bonuses) {
            const amount = bonus.standardBonusAmount;
            if (amount <= 0) continue;
            const health = this.isHealthPremiumMonth()
                ? this.calculatePremium(amount, this.healthRateRow()?.employeeRate ?? null) ?? 0
                : 0;
            const pension = this.isHealthPremiumMonth()
                ? this.calculatePremium(amount, PENSION_RATE) ?? 0
                : 0;
            const care = this.isCarePremiumMonth()
                ? this.calculatePremium(amount, this.careRateRow()?.employeeRate ?? null) ?? 0
                : 0;
            total += health + pension + care;
            hasValue = true;
        }
        return hasValue ? total : null;
    });

    totalSocialInsurancePremium = computed((): number | null => {
        const monthly = this.monthlySocialInsurancePremium();
        const bonus = this.bonusSocialInsurancePremium();
        if (monthly === null && bonus === null) return null;
        return (monthly ?? 0) + (bonus ?? 0);
    });

    isMonthRewardConfirmed = computed(() => isRewardConfirmed(this.standardReward()));

    monthRewardStatusLabel = computed(() =>
        this.isMonthRewardConfirmed() ? '確定' : '登録されていない',
    );

    monthRewardStatusClass = computed(() =>
        this.isMonthRewardConfirmed() ? 'confirmed' : 'unregistered',
    );

    monthRewardTotal = computed((): number | null => {
        const reward = this.standardReward();
        if (!reward) return null;
        return this.sumRewardFields(reward);
    });

    rewardFields = computed((): RewardField[] => {
        const reward = this.standardReward();
        if (!reward) return [];

        const fields: RewardField[] = [
            { label: '基本給', value: reward.basicSalary },
            { label: '通勤手当', value: reward.commutingAllowance },
            { label: '役職手当', value: reward.positionAllowance },
            { label: '住宅手当', value: reward.housingAllowance },
            { label: '見込み残業代', value: reward.fixedOvertimePay },
            { label: 'その他固定手当', value: reward.otherFixedAllowance },
            { label: '残業代', value: reward.overtimePay },
            { label: '休日手当', value: reward.holidayPay },
            { label: '深夜手当', value: reward.nightPay },
            { label: 'インセンティブ', value: reward.commissionPay },
            { label: 'その他変動手当', value: reward.otherVariablePay },
        ];
        return fields.filter((field) => field.value > 0);
    });

    determinationBadgeClass = computed(() => {
        const type = this.effectiveStandard()?.determinationType;
        if (type === 'initial') return 'initial';
        if (type === 'revision') return 'revision';
        return 'regular';
    });

    effectiveCalculationMonthsLabel = computed(() => {
        const months = this.effectiveStandard()?.calculationMonths ?? [];
        if (months.length === 0) return '—';
        return formatYearMonthList(months);
    });

    careTargetLabel = computed(() => {
        if (!this.isCarePremiumMonth()) return '対象外';
        return '開始対象月〜終了月の範囲内';
    });

    careStatusForMonth = computed(() => {
        const status = this.insuranceStatus();
        const employee = this.employee();
        const ym = this.targetYearMonth();
        if (!status || !employee || !ym) return 'unknown' as const;
        return judgeCareInsuranceStatus(
            ym,
            status.healthInsuranceStartDate,
            status.healthInsuranceEndDate,
            employee.birthDate,
        );
    });

    async ngOnInit(): Promise<void> {
        await this.loadPage();
    }

    async onTargetYearMonthChange(yearMonth: string): Promise<void> {
        const employee = this.employee();
        if (!employee || !yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return;

        const clamped = clampViewableYearMonth(employee, yearMonth, this.currentYearMonth());
        if (clamped === this.targetYearMonth()) return;

        this.targetYearMonth.set(clamped);
        await this.loadMonthData();
    }

    async shiftMonth(delta: number): Promise<void> {
        if ((delta < 0 && !this.canGoPrevMonth()) || (delta > 0 && !this.canGoNextMonth())) {
            return;
        }

        const next = addMonthsToYearMonth(this.targetYearMonth(), delta);
        const employee = this.employee();
        if (!employee) return;

        this.targetYearMonth.set(clampViewableYearMonth(employee, next, this.currentYearMonth()));
        await this.loadMonthData();
    }

    insuranceRatePercentLabel(rate: number | null | undefined): string {
        if (rate == null) return '—';
        return `${Number((rate * 100).toFixed(3))}%`;
    }

    careStatusLabel(): string {
        return insuranceJoinStatusLabel(this.careStatusForMonth());
    }

    formatPaymentDate(value: string): string {
        if (!value) return '—';
        const [y, m, d] = value.split('-');
        if (!y || !m || !d) return value;
        return `${y}/${m}/${d}`;
    }

    private async loadPage(): Promise<void> {
        this.isLoading.set(true);
        this.errorMessage.set('');

        try {
            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) {
                await this.router.navigate(['/login']);
                return;
            }

            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (!appUser) {
                this.errorMessage.set('ユーザー情報が見つかりませんでした');
                return;
            }

            if (appUser.status === 'inactive') {
                await this.authService.logout();
                await this.router.navigate(['/login']);
                return;
            }

            if (!appUser.employeeId) {
                this.errorMessage.set('従業員情報が紐づいていません。管理者にお問い合わせください。');
                return;
            }

            const employee = await this.employeeService.getEmployeeById(appUser.employeeId);
            if (!employee) {
                this.errorMessage.set('従業員情報が見つかりませんでした');
                return;
            }

            this.employee.set(employee);
            this.targetYearMonth.set(
                clampViewableYearMonth(employee, this.targetYearMonth(), this.currentYearMonth()),
            );

            const [status, office, allBonuses, company] = await Promise.all([
                this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employee.id),
                this.officeService.getOfficeById(employee.officeId),
                this.bonusRewardService.getBonusRewardsByEmployee(employee.companyId, employee.id),
                this.companyService.getCompanyById(employee.companyId),
            ]);

            this.insuranceStatus.set(status);
            this.office.set(office);
            this.allBonuses.set(allBonuses);
            this.company.set(company);
            if (company) {
                this.insurancePremiumCollectionTiming.set(company.insurancePremiumCollectionTiming);
            }

            await this.loadMonthData();
        } catch (error) {
            console.error('保険料ページの取得に失敗しました', error);
            this.errorMessage.set('保険料情報の取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    private async loadMonthData(): Promise<void> {
        const employee = this.employee();
        const targetYearMonth = this.targetYearMonth();
        if (!employee || !targetYearMonth) return;

        this.isLoadingMonth.set(true);

        try {
            const [reward, allRewards] = await Promise.all([
                this.rewardService.getByEmployeeAndMonth(employee.id, targetYearMonth),
                this.rewardService.listByEmployee(employee.id),
            ]);

            this.standardReward.set(reward);
            this.allRewards.set(allRewards);

            const monthBonuses = this.allBonuses()
                .filter((bonus) => bonus.targetYearMonth === targetYearMonth)
                .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
            this.monthBonuses.set(monthBonuses);

            const rewardsByYearMonth = confirmedRewardsByYearMonth(
                Object.fromEntries(allRewards.map((item) => [item.targetYearMonth, item])),
            );

            const effective = this.determinationService.resolve(
                employee,
                rewardsByYearMonth,
                targetYearMonth,
                this.insuranceStatus()?.healthInsuranceStartDate ?? null,
                this.allBonuses(),
            );
            this.effectiveStandard.set(effective);

            const office = this.office();
            if (office) {
                const fiscalYear = this.healthInsuranceFiscalYear(targetYearMonth);
                const fileName = `kyokai-health-insurance-rates-${fiscalYear}-03.ts`;
                const rates =
                    KYOKAI_HEALTH_INSURANCE_RATE_FILES.find((file) => file.fileName === fileName)?.rates ?? [];

                this.healthRateRow.set(
                    findHealthInsuranceRate({
                        rates,
                        targetYearMonth,
                        providerType: office.healthInsuranceType ?? 'kyokai',
                        prefecture: office.prefecture ?? null,
                    }),
                );
                this.careRateRow.set(findCareInsuranceRate(targetYearMonth));
            } else {
                this.healthRateRow.set(null);
                this.careRateRow.set(null);
            }
        } catch (error) {
            console.error('月次データの取得に失敗しました', error);
            this.errorMessage.set('月次データの取得に失敗しました');
        } finally {
            this.isLoadingMonth.set(false);
        }
    }

    private calculatePremium(amount: number | null, rate: number | null): number | null {
        if (amount === null || rate === null) return null;
        return roundInsurancePremium(amount * rate);
    }

    private sumRewardFields(reward: StandardMonthlyReward): number {
        return (
            reward.basicSalary +
            reward.commutingAllowance +
            reward.positionAllowance +
            reward.housingAllowance +
            reward.fixedOvertimePay +
            reward.otherFixedAllowance +
            reward.overtimePay +
            reward.holidayPay +
            reward.nightPay +
            reward.commissionPay +
            reward.otherVariablePay
        );
    }

    private currentYearMonth(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    private healthInsuranceFiscalYear(targetYearMonth: string): string {
        const [y, m] = targetYearMonth.split('-').map(Number);
        return m < 3 ? String(y - 1) : String(y);
    }
}
