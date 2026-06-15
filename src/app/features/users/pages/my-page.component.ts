import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../services/user.service';
import { AppUser } from '../models/user.model';
import { Employee, Dependent, EmploymentType } from '../../employee/models/employee.models';
import {
    employeeDisplayStatusLabel,
    isEmployeeFullyRetired,
    isEmployeePendingRetirement,
} from '../../employee/utils/employee-status-display.util';
import { EmployeeService } from '../../employee/services/employee.service';
import { SocialInsuranceStatus } from '../../social-insurance/models/social-insurance-status.model';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { SocialInsuranceProcedureService } from '../../social-insurance/services/social-insurance-procedure.service';
import { CompanyService } from '../../company/services/company.service';
import { OfficeService } from '../../company/services/office.service';
import { resolveOfficePrefecture } from '../../company/utils/office-prefecture.util';
import { StandardMonthlyRewardService } from '../../insurance/services/standard-monthly-reward.service';
import { StandardRemunerationDeterminationService } from '../../insurance/services/standard-remuneration-determination.service';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { Procedure, ProcedureStatus, ProcedureType } from '../../social-insurance/models/procedures.model';
import {
    formatInsuranceDate,
    insuranceJoinStatusListLabel,
    InsuranceJoinKind,
} from '../../social-insurance/utils/social-insurance-status-display.util';
import {
    dateLabel,
    procedureStatusLabel,
    procedureTypeLabel,
} from '../../social-insurance/utils/procedure-display.util';
import { confirmedRewardsByYearMonth } from '../../insurance/utils/reward-status.util';
import { findCareInsuranceRate, findHealthInsuranceRate } from '../../insurance-rate/utils/insurance-rate-lookup.util';
import { KYOKAI_HEALTH_INSURANCE_RATE_FILES } from '../../insurance-rate/data/insurance-rates';
import { roundInsurancePremium } from '../../insurance/utils/insurance-premium-rounding.util';
import { formatYearMonthLabel } from '../../insurance/utils/standard-remuneration-determination.util';
import { isCareInsurancePremiumTargetMonth } from '../../social-insurance/utils/care-insurance-period.util';
import {
    isHealthInsurancePremiumTargetMonth,
    isPensionInsurancePremiumTargetMonth,
} from '../../social-insurance/utils/age-premium-period.util';

type MyPageProcedureItem = {
    id: string;
    procedureType: ProcedureType;
    status: ProcedureStatus;
    completedDate: string | null;
    submittedDate: string | null;
};

type PremiumSummary = {
    targetYearMonth: string;
    healthPremium: number | null;
    pensionPremium: number | null;
    carePremium: number | null;
    totalPremium: number | null;
    standardAmount: number | null;
    description: string;
};

const RELATIONSHIP_LABELS: Record<Dependent['relationship'], string> = {
    spouse: '配偶者',
    child: '子',
    parent: '父母',
    other: 'その他',
};

@Component({
    selector: 'app-my-page',
    standalone: true,
    imports: [RouterLink, DecimalPipe],
    templateUrl: './my-page.component.html',
})
export class MyPageComponent implements OnInit {
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly employeeService = inject(EmployeeService);
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly companyService = inject(CompanyService);
    private readonly officeService = inject(OfficeService);
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly determinationService = inject(StandardRemunerationDeterminationService);
    private readonly bonusRewardService = inject(BonusRewardService);
    private readonly router = inject(Router);

    readonly formatInsuranceDate = formatInsuranceDate;
    readonly procedureStatusLabel = procedureStatusLabel;
    readonly procedureTypeLabel = procedureTypeLabel;
    readonly dateLabel = dateLabel;

    currentUser = signal<AppUser | null>(null);
    employee = signal<Employee | null>(null);
    insuranceStatus = signal<SocialInsuranceStatus | null>(null);
    companyName = signal('');
    officeName = signal('');
    dependents = signal<Dependent[]>([]);
    procedures = signal<MyPageProcedureItem[]>([]);
    premiumSummary = signal<PremiumSummary | null>(null);
    qualificationSubmitted = signal(false);

    loading = signal(true);
    message = signal('');

    displayName = computed(() => {
        const employee = this.employee();
        if (employee) {
            return `${employee.lastName} ${employee.firstName}`.trim();
        }
        const user = this.currentUser();
        if (!user) return '—';
        return `${user.lastName} ${user.firstName}`.trim() || '—';
    });

    displayNameKana = computed(() => {
        const employee = this.employee();
        if (employee) {
            const kana = `${employee.lastNameKana} ${employee.firstNameKana}`.trim();
            return kana || '—';
        }
        const user = this.currentUser();
        if (!user) return '—';
        const kana = `${user.lastNameKana} ${user.firstNameKana}`.trim();
        return kana || '—';
    });

    userInitial = computed(() => this.displayName().charAt(0) || '？');

    targetYearMonthLabel = computed(() => {
        const summary = this.premiumSummary();
        return summary ? formatYearMonthLabel(summary.targetYearMonth) : formatYearMonthLabel(this.currentYearMonth());
    });

    activeDependents = computed(() => this.dependents().filter((d) => d.status === 'active'));

    hasEmployeeLink = computed(() => Boolean(this.currentUser()?.employeeId && this.employee()));

    async ngOnInit(): Promise<void> {
        await this.loadPage();
    }

    insuranceStatusLabel(kind: InsuranceJoinKind): string {
        return insuranceJoinStatusListLabel(
            this.insuranceStatusValue(kind),
            kind,
            this.insuranceStatus(),
            this.qualificationSubmitted(),
        );
    }

    isInsuranceEnrolled(kind: InsuranceJoinKind): boolean {
        return this.insuranceStatusLabel(kind) === '加入中';
    }

    employmentTypeLabel(type: EmploymentType): string {
        if (type === 'full-time') return '正社員';
        if (type === 'part-time') return 'パート・アルバイト';
        return '—';
    }

    employeeStatusLabel(employee: Employee): string {
        return employeeDisplayStatusLabel(employee);
    }

    isPendingRetirement(employee: Employee): boolean {
        return isEmployeePendingRetirement(employee);
    }

    isFullyRetired(employee: Employee): boolean {
        return isEmployeeFullyRetired(employee);
    }

    genderLabel(gender: Employee['gender']): string {
        return gender === 'male' ? '男性' : '女性';
    }

    formatAddress(employee: Employee): string {
        const parts = [
            employee.postalCode ? `〒${employee.postalCode}` : '',
            employee.prefecture,
            employee.city,
            employee.streetAddress,
            employee.buildingName,
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : '—';
    }

    formatBirthDate(value: string): string {
        return formatInsuranceDate(value);
    }

    myNumberStatus(employee: Employee | null): string {
        return employee?.myNumber?.trim() ? '登録済み' : '未登録';
    }

    relationshipLabel(relationship: Dependent['relationship']): string {
        return RELATIONSHIP_LABELS[relationship];
    }

    private insuranceStatusValue(kind: InsuranceJoinKind) {
        const status = this.insuranceStatus();
        if (!status) return 'unknown' as const;
        if (kind === 'health') return status.healthInsuranceStatus;
        if (kind === 'pension') return status.pensionInsuranceStatus;
        return status.careInsuranceStatus;
    }

    private async loadPage(): Promise<void> {
        this.loading.set(true);
        this.message.set('');

        try {
            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) {
                await this.router.navigate(['/login']);
                return;
            }

            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (!appUser) {
                this.message.set('ユーザー情報が見つかりませんでした');
                return;
            }

            if (appUser.status === 'inactive') {
                await this.authService.logout();
                await this.router.navigate(['/login']);
                return;
            }

            this.currentUser.set(appUser);

            if (!appUser.employeeId) {
                this.message.set('従業員情報が紐づいていません。管理者にお問い合わせください。');
                return;
            }

            await this.loadEmployee(appUser.employeeId);
            await this.loadSocialInsuranceStatus(appUser.employeeId);

            await Promise.all([
                this.loadProcedures(appUser),
                this.loadDependents(appUser.employeeId),
                this.loadCompanyAndOffice(),
                this.loadPremiumSummary(appUser.employeeId),
            ]);
        } catch (error) {
            console.error('マイページの取得に失敗しました', error);
            this.message.set('マイページの取得に失敗しました');
        } finally {
            this.loading.set(false);
        }
    }

    private async loadEmployee(employeeId: string): Promise<void> {
        const employee = await this.employeeService.getEmployeeById(employeeId);
        this.employee.set(employee);
        if (!employee) {
            this.message.set('従業員情報が見つかりませんでした');
        }
    }

    private async loadSocialInsuranceStatus(employeeId: string): Promise<void> {
        const status = await this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employeeId);
        this.insuranceStatus.set(status);
    }

    private async loadDependents(employeeId: string): Promise<void> {
        const dependents = await this.employeeService.getDependentsByEmployeeId(employeeId);
        this.dependents.set(dependents);
    }

    private async loadCompanyAndOffice(): Promise<void> {
        const user = this.currentUser();
        const employee = this.employee();
        if (!user) return;

        const [company, office] = await Promise.all([
            this.companyService.getCompanyById(user.companyId),
            employee?.officeId
                ? this.officeService.getOfficeById(employee.officeId)
                : Promise.resolve(null),
        ]);
        this.companyName.set(company?.name ?? '—');
        this.officeName.set(office?.name ?? '—');
    }

    private async loadProcedures(user: AppUser): Promise<void> {
        const employeeId = user.employeeId;
        if (!employeeId) return;

        const [qualification, loss, dependentChange] = await Promise.all([
            this.procedureService.getQualificationProcedureByEmployeeId(employeeId, user.companyId),
            this.procedureService.getLossProcedureByEmployeeId(employeeId, user.companyId),
            this.procedureService.getOpenDependentChangeProcedureByEmployeeId(employeeId),
        ]);

        this.qualificationSubmitted.set(qualification?.status === 'completed');

        const items: MyPageProcedureItem[] = [];
        for (const procedure of [qualification, loss, dependentChange]) {
            if (!procedure) continue;
            items.push({
                id: procedure.id,
                procedureType: procedure.procedureType,
                status: procedure.status,
                completedDate: procedure.completedDate,
                submittedDate: procedure.submittedDate,
            });
        }
        this.procedures.set(items);
    }

    private async loadPremiumSummary(employeeId: string): Promise<void> {
        const employee = this.employee();
        if (!employee) return;

        const targetYearMonth = this.currentYearMonth();
        const [rewards, bonuses, office] = await Promise.all([
            this.rewardService.listByEmployee(employeeId),
            this.bonusRewardService.getBonusRewardsByEmployee(employee.companyId, employeeId),
            this.officeService.getOfficeById(employee.officeId),
        ]);

        const rewardsByYearMonth = confirmedRewardsByYearMonth(
            Object.fromEntries(rewards.map((reward) => [reward.targetYearMonth, reward])),
        );

        const effective = this.determinationService.resolve(
            employee,
            rewardsByYearMonth,
            targetYearMonth,
            this.insuranceStatus()?.healthInsuranceStartDate ?? null,
            bonuses,
        );

        const standardAmount =
            effective.isComplete && effective.calculation?.health
                ? effective.calculation.health.standardMonthlyAmount
                : null;

        let healthPremium: number | null = null;
        let pensionPremium: number | null = null;
        let carePremium: number | null = null;

        const insuranceStatus = this.insuranceStatus();
        const isHealthPremiumMonth =
            insuranceStatus &&
            isHealthInsurancePremiumTargetMonth(
                targetYearMonth,
                insuranceStatus.healthInsuranceStartDate,
                insuranceStatus.healthInsuranceEndDate,
                employee.birthDate,
            );
        const isPensionPremiumMonth =
            insuranceStatus &&
            isPensionInsurancePremiumTargetMonth(
                targetYearMonth,
                insuranceStatus.healthInsuranceStartDate,
                insuranceStatus.healthInsuranceEndDate,
                insuranceStatus.pensionInsuranceStartDate,
                insuranceStatus.pensionInsuranceEndDate,
                employee.birthDate,
            );

        if (standardAmount && office && (isHealthPremiumMonth || isPensionPremiumMonth)) {
            const fiscalYear = this.healthInsuranceFiscalYear(targetYearMonth);
            const fileName = `kyokai-health-insurance-rates-${fiscalYear}-03.ts`;
            const rates =
                KYOKAI_HEALTH_INSURANCE_RATE_FILES.find((file) => file.fileName === fileName)?.rates ?? [];
            const healthRate = findHealthInsuranceRate({
                rates,
                targetYearMonth,
                providerType: office.healthInsuranceType ?? 'kyokai',
                prefecture: resolveOfficePrefecture(office, employee.prefecture),
            });
            const careRate = findCareInsuranceRate(targetYearMonth);

            if (healthRate && isHealthPremiumMonth) {
                healthPremium = roundInsurancePremium(standardAmount * healthRate.employeeRate);
            }
            if (isPensionPremiumMonth) {
                pensionPremium = roundInsurancePremium(standardAmount * 0.0915);
            }
            if (
                careRate &&
                employee &&
                isCareInsurancePremiumTargetMonth(
                    targetYearMonth,
                    insuranceStatus.healthInsuranceStartDate,
                    insuranceStatus.healthInsuranceEndDate,
                    employee.birthDate,
                )
            ) {
                carePremium = roundInsurancePremium(standardAmount * careRate.employeeRate);
            }
        }

        const totalPremium =
            healthPremium !== null || pensionPremium !== null || carePremium !== null
                ? (healthPremium ?? 0) + (pensionPremium ?? 0) + (carePremium ?? 0)
                : null;

        this.premiumSummary.set({
            targetYearMonth,
            healthPremium,
            pensionPremium,
            carePremium,
            totalPremium,
            standardAmount,
            description: effective.description,
        });
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
