import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Procedure, ProcedureStatus, ProcedureType, ProcedureInput } from '../models/procedures.model';
import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';

@Component({
    selector: 'app-social-insurance-procedures-page',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './social-insurance-procedures-page.component.html',
})

export class SocialInsuranceProceduresPageComponent {
    private readonly procedureService = inject(SocialInsuranceProcedureService);

    // 手続き一覧
    procedures = signal<Procedure[]>([]);

    // ローディング
    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    // 初期処理
    async ngOnInit() {
        this.isLoading.set(true);
        this.errorMessage.set('');

        await this.loadProcedures();
    }

    // 手続きの取得
    async loadProcedures() {
        try {
            const procedures = await this.procedureService.getProcedures();
            this.procedures.set(procedures);
        } catch (error) {
            console.error('手続きの取得に失敗しました', error);
            this.errorMessage.set('手続きの取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    // 手続き種別のラベル
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

    // 対応状況のラベル
    statusLabel(status: ProcedureStatus): string {
        const labels: Record<ProcedureStatus, string> = {
            notStarted: '未対応',
            inProgress: '対応中',
            completed: '完了',
        };
        return labels[status];
    }

    // 手続きの作成
    async createProcedure(procedureType: ProcedureType) {
        const procedureInput: ProcedureInput = {
            companyId: 'EF7Dtp9JYQwby3eqD2qh',
            officeId: 'n8ufJE71qFq51Kgf62Tj',
            employeeId: 'KpFpz33VMOAlIqFU1aeh',
            procedureType: procedureType,
            status: 'notStarted',
            occurredDate: '',
            dueDate: '',
            completedDate: null,
            targetYearMonth: null,
            memo: '',
            lossReason: null,
            dependentChanges: null,
        }
        try {
            await this.procedureService.createProcedure(procedureInput);
            console.log('手続きの作成に成功しました');
        } catch (error) {
            console.error('手続きの作成に失敗しました', error);
            this.errorMessage.set('手続きの作成に失敗しました');
        }
    }
}