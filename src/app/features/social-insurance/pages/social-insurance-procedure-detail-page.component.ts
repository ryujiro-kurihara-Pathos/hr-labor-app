import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { EmployeeService } from '../../employee/services/employee.service';
import { OfficeService } from '../../company/services/office.service';
import { CompanyService } from '../../company/services/company.service';

import { Procedure } from '../models/procedures.model';
import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';

import { QualificationProcedureComponent } from './qualification-procedure.component';

@Component({
    selector: 'app-social-insurance-procedure-detail-page',
    standalone: true,
    imports: [RouterLink, QualificationProcedureComponent],
    templateUrl: './social-insurance-procedure-detail-page.component.html',
})

export class SocialInsuranceProcedureDetailPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly companyService = inject(CompanyService);

    procedure = signal<Procedure | null>(null);
    employee = signal<Employee | null>(null);
    office = signal<Office | null>(null);
    company = signal<Company | null>(null);

    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

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

    private async loadOffice(): Promise<void> {
        this.office.set(null);

        const procedure = this.procedure();
        const employee = this.employee();
        const officeId = procedure?.officeId || employee?.officeId;
        if (!officeId) return;

        try {
            const office = await this.officeService.getOfficeById(officeId);
            this.office.set(office);
        } catch (error) {
            console.error('事業所の取得に失敗しました', error);
            this.errorMessage.set('事業所の取得に失敗しました');
        }
    }

    private async loadCompany(): Promise<void> {
        this.company.set(null);

        const companyId = this.employee()?.companyId;
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
