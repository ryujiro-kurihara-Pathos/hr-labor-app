import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { SocialInsuranceStatusService } from '../services/social-insurance-status.service';
import { EmployeeService } from '../../employee/services/employee.service';
import { OfficeService } from '../../company/services/office.service';
import { CompanyService } from '../../company/services/company.service';
import { BonusRewardService } from '../../bonus/services/bonus-reward.service';
import { StandardMonthlyRewardService } from '../../insurance/services/standard-monthly-reward.service';
import { SalaryConditionService } from '../../insurance/services/salary-condition.service';
import { yearMonthFromDateString } from '../../insurance/utils/reward-target-month.util';

import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { Procedure } from '../models/procedures.model';
import { hasSavedQualificationData } from '../utils/qualification-procedure-data.util';
import {
    resolveQualificationJoinMonthReward,
    resolveQualificationMonthlyReward,
} from '../utils/qualification-reward.util';
import { SocialInsuranceStatus } from '../models/social-insurance-status.model';
import { StandardMonthlyReward } from '../../insurance/models/standard-monthly-reward.model';
import { SalaryCondition } from '../../insurance/models/salary-condition.model';
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
    imports: [QualificationProcedureComponent, LossProcedureComponent, DependentProcedureComponent, EmployeeProcedureSheetComponent],
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
    private readonly salaryConditionService = inject(SalaryConditionService);

    procedure = signal<Procedure | null>(null);
    socialInsuranceStatus = signal<SocialInsuranceStatus | null>(null);
    hasActiveDependents = signal(false);
    dependents = signal<Dependent[]>([]);
    joinMonthReward = signal<StandardMonthlyReward | null>(null);
    joinMonthRewardFromExpected = signal(false);
    salaryConditions = signal<SalaryCondition[]>([]);
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
        await this.syncQualificationProcedureIfNeeded();
        await this.loadDependents();
        await this.loadCompany();
        await this.loadSalaryConditions();
        await Promise.all([this.loadJoinMonthReward(), this.loadEmployeeBonuses()]);
        await this.syncQualificationProcedureRewardPreview();
        await this.loadOffice();

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

    private async loadSalaryConditions(): Promise<void> {
        this.salaryConditions.set([]);

        const employee = this.employee();
        if (!employee || this.procedure()?.procedureType !== 'qualification') return;

        try {
            const conditions = await this.salaryConditionService.listByEmployee(employee.id);
            this.salaryConditions.set(conditions);
        } catch (error) {
            console.error('給与条件の取得に失敗しました', error);
        }
    }

    private async loadJoinMonthReward(): Promise<void> {
        this.joinMonthReward.set(null);
        this.joinMonthRewardFromExpected.set(false);

        const employee = this.employee();
        if (!employee || this.procedure()?.procedureType !== 'qualification') return;

        const joinYearMonth = yearMonthFromDateString(employee.joinedDate);
        if (!joinYearMonth) return;

        try {
            const rewards = await this.rewardService.listByEmployee(employee.id);
            const rewardsByYearMonth = Object.fromEntries(
                rewards.map((reward) => [reward.targetYearMonth, reward]),
            );
            const { reward, fromExpectedSalaryCondition } = resolveQualificationJoinMonthReward({
                joinedDate: employee.joinedDate,
                companyId: employee.companyId,
                employeeId: employee.id,
                employmentType: employee.employmentType,
                salaryConditions: this.salaryConditions(),
                rewardsByYearMonth,
                payrollPaymentMonthOffset: this.company()?.payrollPaymentMonthOffset ?? 1,
            });
            this.joinMonthReward.set(reward);
            this.joinMonthRewardFromExpected.set(fromExpectedSalaryCondition);
        } catch (error) {
            console.error('入社月の報酬月額の取得に失敗しました', error);
        }
    }

    private async syncQualificationProcedureRewardPreview(): Promise<void> {
        const procedure = this.procedure();
        const employee = this.employee();
        if (!procedure || !employee || procedure.procedureType !== 'qualification') return;
        if (procedure.status === 'completed') return;

        const monthlyReward = resolveQualificationMonthlyReward(
            employee.joinedDate,
            this.joinMonthReward(),
            this.employeeBonuses(),
            employee.employmentType,
            this.joinMonthRewardFromExpected(),
        );

        try {
            const updated = await this.procedureService.syncQualificationProcedureRewardPreview(
                procedure,
                monthlyReward,
            );
            this.procedure.set(updated);
        } catch (error) {
            console.error('資格取得届への報酬反映に失敗しました', error);
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

    private async syncQualificationProcedureIfNeeded(): Promise<void> {
        const procedure = this.procedure();
        const employee = this.employee();
        const status = this.socialInsuranceStatus();
        if (!procedure || !employee || procedure.procedureType !== 'qualification') return;
        if (procedure.status === 'completed') return;

        try {
            const synced = await this.procedureService.syncQualificationProcedureForEmployee({
                employee,
                healthInsuranceStartDate: status?.healthInsuranceStartDate ?? null,
                healthInsuranceStatus: status?.healthInsuranceStatus,
                pensionInsuranceStatus: status?.pensionInsuranceStatus,
                previousJoinedDate: employee.joinedDate,
            });
            if (synced) {
                this.procedure.set(synced);
            }
        } catch (error) {
            console.error('資格取得届の同期に失敗しました', error);
        }
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
