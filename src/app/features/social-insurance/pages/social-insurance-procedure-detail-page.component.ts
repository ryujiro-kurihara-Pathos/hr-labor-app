import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { SocialInsuranceStatusService } from '../services/social-insurance-status.service';
import { EmployeeService } from '../../employee/services/employee.service';
import { OfficeService } from '../../company/services/office.service';
import { CompanyService } from '../../company/services/company.service';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { StandardMonthlyRewardService } from '../../insurance/services/standard-monthly-reward.service';
import { yearMonthFromDateString } from '../../insurance/utils/reward-target-month.util';

import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { Procedure } from '../models/procedures.model';
import { hasSavedQualificationData } from '../utils/qualification-procedure-data.util';
import { SocialInsuranceStatus } from '../models/social-insurance-status.model';
import { StandardMonthlyReward } from '../../insurance/models/standard-monthly-reward.model';
import { Dependent, Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';

import { QualificationProcedureComponent } from './qualification-procedure.component';
import { LossProcedureComponent } from './loss-procedure.component';
import { DependentProcedureComponent } from './dependent-procedure.component';
import { EmployeeProcedureSheetComponent } from './employee-procedure-sheet.component';

@Component({
    selector: 'app-social-insurance-procedure-detail-page',
    standalone: true,
    imports: [RouterLink, QualificationProcedureComponent, LossProcedureComponent, DependentProcedureComponent, EmployeeProcedureSheetComponent],
    templateUrl: './social-insurance-procedure-detail-page.component.html',
})

export class SocialInsuranceProcedureDetailPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly companyService = inject(CompanyService);
    private readonly rewardService = inject(StandardMonthlyRewardService);
    private readonly bonusRewardService = inject(BonusRewardService);

    procedure = signal<Procedure | null>(null);
    socialInsuranceStatus = signal<SocialInsuranceStatus | null>(null);
    hasActiveDependents = signal(false);
    dependents = signal<Dependent[]>([]);
    joinMonthReward = signal<StandardMonthlyReward | null>(null);
    employeeBonuses = signal<BonusReward[]>([]);
    employee = signal<Employee | null>(null);
    office = signal<Office | null>(null);
    company = signal<Company | null>(null);

    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    canShowProcedure = computed((): boolean => {
        const item = this.procedure();
        if (!item) return false;

        if (item.procedureType === 'qualification' && item.status === 'completed' && hasSavedQualificationData(item)) {
            return true;
        }

        return Boolean(this.employee() && this.office() && this.company());
    });

    async ngOnInit(): Promise<void> {
        this.isLoading.set(true);
        this.errorMessage.set('');

        const procedureId = this.route.snapshot.params['procedureId'] ?? '';
        if (!procedureId) {
            this.errorMessage.set('手続きが見つかりませんでした');
            this.isLoading.set(false);
            return;
        }

        await this.loadProcedure(procedureId);
        if (!this.procedure()) {
            this.isLoading.set(false);
            return;
        }

        await this.loadEmployee();
        await this.loadSocialInsuranceStatus();
        await this.loadDependents();
        await Promise.all([this.loadJoinMonthReward(), this.loadEmployeeBonuses()]);
        await this.loadOffice();
        await this.loadCompany();

        this.isLoading.set(false);
    }

    private async loadProcedure(procedureId: string): Promise<void> {
        this.procedure.set(null);

        try {
            const procedure = await this.procedureService.getProcedureById(procedureId);
            this.procedure.set(procedure);

            if (!procedure) {
                this.errorMessage.set('手続きが見つかりませんでした');
            }
        } catch (error) {
            console.error('手続きの取得に失敗しました', error);
            this.errorMessage.set('手続きの取得に失敗しました');
        }
    }

    private async loadEmployee(): Promise<void> {
        this.employee.set(null);

        const employeeId = this.procedure()?.employeeId;
        if (!employeeId) return;

        try {
            const employee = await this.employeeService.getEmployeeById(employeeId);
            this.employee.set(employee);
        } catch (error) {
            console.error('従業員の取得に失敗しました', error);
            this.errorMessage.set('従業員の取得に失敗しました');
        }
    }

    private async loadSocialInsuranceStatus(): Promise<void> {
        this.socialInsuranceStatus.set(null);

        const employeeId = this.procedure()?.employeeId;
        const procedureType = this.procedure()?.procedureType;
        if (!employeeId || (procedureType !== 'loss' && procedureType !== 'qualification')) return;

        try {
            const status = await this.socialInsuranceStatusService.getInsuranceStatusByEmployeeId(employeeId);
            this.socialInsuranceStatus.set(status);
        } catch (error) {
            console.error('社会保険加入状況の取得に失敗しました', error);
            this.errorMessage.set('社会保険加入状況の取得に失敗しました');
        }
    }

    private async loadDependents(): Promise<void> {
        this.hasActiveDependents.set(false);
        this.dependents.set([]);

        const employeeId = this.procedure()?.employeeId;
        const procedureType = this.procedure()?.procedureType;
        if (!employeeId || (procedureType !== 'qualification' && procedureType !== 'dependentChange')) {
            return;
        }

        try {
            const dependents = await this.employeeService.getDependentsByEmployeeId(employeeId);
            this.dependents.set(dependents);
            this.hasActiveDependents.set(dependents.some((d) => d.status === 'active'));
        } catch (error) {
            console.error('扶養家族の取得に失敗しました', error);
        }
    }

    private async loadJoinMonthReward(): Promise<void> {
        this.joinMonthReward.set(null);

        const employee = this.employee();
        if (!employee || this.procedure()?.procedureType !== 'qualification') return;

        const joinYearMonth = yearMonthFromDateString(employee.joinedDate);
        if (!joinYearMonth) return;

        try {
            const reward = await this.rewardService.getByEmployeeAndMonth(employee.id, joinYearMonth);
            this.joinMonthReward.set(reward);
        } catch (error) {
            console.error('入社月の報酬月額の取得に失敗しました', error);
        }
    }

    private async loadEmployeeBonuses(): Promise<void> {
        this.employeeBonuses.set([]);

        const employee = this.employee();
        if (!employee?.companyId) return;

        try {
            const bonuses = await this.bonusRewardService.getBonusRewardsByEmployee(
                employee.companyId,
                employee.id,
            );
            this.employeeBonuses.set(bonuses);
        } catch (error) {
            console.error('賞与の取得に失敗しました', error);
        }
    }

    private async loadOffice(): Promise<void> {
        this.office.set(null);

        const procedure = this.procedure();
        const employee = this.employee();
        const officeId = employee?.officeId || procedure?.officeId;
        if (!officeId) return;

        try {
            const office = await this.officeService.getOfficeById(officeId);
            this.office.set(office);
        } catch (error) {
            console.error('事業所の取得に失敗しました', error);
            this.errorMessage.set('事業所の取得に失敗しました');
        }
    }

    onProcedureUpdated(procedure: Procedure): void {
        this.procedure.set(procedure);
    }

    async onDependentsUpdated(): Promise<void> {
        await this.loadDependents();
    }

    private async loadCompany(): Promise<void> {
        this.company.set(null);

        const companyId = this.employee()?.companyId || this.procedure()?.companyId;
        if (!companyId) return;

        try {
            const company = await this.companyService.getCompanyById(companyId);
            this.company.set(company);
        } catch (error) {
            console.error('会社の取得に失敗しました', error);
            this.errorMessage.set('会社の取得に失敗しました');
        }
    }
}
