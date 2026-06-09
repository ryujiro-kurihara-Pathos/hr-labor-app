import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { EmployeeService } from '../../employee/services/employee.service';

import { Procedure, ProcedureInput, ProcedureStatus, ProcedureType } from '../models/procedures.model';
import { Employee } from '../../employee/models/employee.models';

@Component({
    selector: 'app-social-insurance-procedure-detail-page',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './social-insurance-procedure-detail-page.component.html',
})

export class SocialInsuranceProcedureDetailPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly employeeService = inject(EmployeeService);

    // 手続き情報
    procedure = signal<Procedure | null>(null);
    procedureId = signal<string | null>(null);
    employee = signal<Employee | null>(null);
    employeeId = signal<string | null>(null);

    // ローディング
    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    async ngOnInit() {
        this.isLoading.set(true);
        this.errorMessage.set('');

        const procedureId = this.route.snapshot.params['procedureId'] ?? '';
        this.procedureId.set(procedureId);

        if (!procedureId) {
            this.errorMessage.set('手続きが見つかりませんでした');
            return;
        }

        await this.loadProcedure();
        await this.loadEmployee();

        this.isLoading.set(false);
    }

    // 手続きの読み込み
    async loadProcedure(): Promise<void> {
        this.procedure.set(null);

        const procedureId = this.procedureId();
        if(!procedureId) return;

        try {
            const procedure = await this.procedureService.getProcedureById(procedureId);
            this.procedure.set(procedure);

            if (!procedure) {
                this.errorMessage.set('手続きが見つかりませんでした');
                return;
            }

            this.employeeId.set(procedure.employeeId);
        } catch (error) {
            console.error('手続きの取得に失敗しました', error);
            this.errorMessage.set('手続きの取得に失敗しました');
            this.isLoading.set(false);
        }
    }

    // 従業員の読み込み
    async loadEmployee(): Promise<void> {
        this.employee.set(null);

        const employeeId = this.employeeId();
        if(!employeeId) return;

        try {
            const employee = await this.employeeService.getEmployeeById(employeeId);
            this.employee.set(employee);
        } catch (error) {
            console.error('従業員の取得に失敗しました', error);
            this.errorMessage.set('従業員の取得に失敗しました');
            this.isLoading.set(false);
        }
    }

    // 手続きを登録する
    async onCreateProcedure(type: ProcedureType) {
        const input: ProcedureInput = {
            companyId: '',
            employeeId: null,
            procedureType: type,
            status: 'inProgress',
            occurredDate: '',
            dueDate: '',
            completedDate: null,
            targetYearMonth: null,
            memo: '',
        };
        try {
            await this.procedureService.createProcedure(input);
            console.log('手続きの登録に成功しました。');
        } catch (error) {
            console.error('手続きの登録に失敗しました。', error);
            this.errorMessage.set('手続きの登録に失敗しました。');
        } finally {
            this.isLoading.set(false);
        }
    }

    procedureTypeLabel(type: ProcedureType): string {
        const labels: Record<ProcedureType, string> = {
            qualification: '資格取得',
            loss: '資格喪失',
            dependentChange: '扶養変更',
            regularDecision: '算定基礎届',
            revision: '月額変更届',
            bonusPayment: '賞与支払届',
            premiumPayment: '保険料納付',
        };
        return labels[type];
    }

    statusLabel(status: ProcedureStatus): string {
        const labels: Record<ProcedureStatus, string> = {
            notStarted: '未対応',
            inProgress: '対応中',
            completed: '完了',
        };
        return labels[status];
    }
}