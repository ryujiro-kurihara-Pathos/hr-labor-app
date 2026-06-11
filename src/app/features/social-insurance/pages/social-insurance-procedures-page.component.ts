import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Procedure, ProcedureType } from '../models/procedures.model';
import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { EmployeeService } from '../../employee/services/employee.service';
import {
    compareProceduresForList,
    dateLabel,
    isProcedureOverdue,
    procedureStatusLabel,
    procedureTypeLabel,
    procedureTypeMeta,
    resolveProcedureSubjectName,
    todayDateString,
} from '../utils/procedure-display.util';

type StatusFilter = 'all' | 'action' | 'notStarted' | 'inProgress' | 'completed';

@Component({
    selector: 'app-social-insurance-procedures-page',
    standalone: true,
    imports: [RouterLink, FormsModule],
    templateUrl: './social-insurance-procedures-page.component.html',
})
export class SocialInsuranceProceduresPageComponent {
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly employeeService = inject(EmployeeService);

    readonly procedureTypeLabel = procedureTypeLabel;
    readonly procedureTypeMeta = procedureTypeMeta;
    readonly procedureStatusLabel = procedureStatusLabel;
    readonly dateLabel = dateLabel;

    procedures = signal<Procedure[]>([]);
    employeeNameById = signal<Record<string, string>>({});

    isLoading = signal(false);
    errorMessage = signal('');

    statusFilter = signal<StatusFilter>('action');
    typeFilter = signal<'' | ProcedureType>('');

    statusTabs: { id: StatusFilter; label: string }[] = [
        { id: 'action', label: '要対応' },
        { id: 'all', label: 'すべて' },
        { id: 'notStarted', label: '未対応' },
        { id: 'inProgress', label: '対応中' },
        { id: 'completed', label: '完了' },
    ];

    typeFilterOptions: { value: '' | ProcedureType; label: string }[] = [
        { value: '', label: 'すべての種別' },
        { value: 'qualification', label: '資格取得' },
        { value: 'loss', label: '資格喪失' },
        { value: 'dependentChange', label: '扶養変更' },
        { value: 'regularDecision', label: '算定基礎届' },
        { value: 'revision', label: '月額変更届' },
        { value: 'bonusPayment', label: '賞与支払届' },
        { value: 'premiumPayment', label: '保険料納付' },
    ];

    actionCount = computed(
        () => this.procedures().filter((p) => p.status !== 'completed').length,
    );

    overdueCount = computed(() =>
        this.procedures().filter((p) => isProcedureOverdue(p, this.today())).length,
    );

    filteredProcedures = computed(() => {
        const status = this.statusFilter();
        const type = this.typeFilter();
        const today = this.today();

        let list = [...this.procedures()];

        if (status === 'action') {
            list = list.filter((p) => p.status !== 'completed');
        } else if (status !== 'all') {
            list = list.filter((p) => p.status === status);
        }

        if (type) {
            list = list.filter((p) => p.procedureType === type);
        }

        return list.sort((a, b) => compareProceduresForList(a, b, today));
    });

    async ngOnInit() {
        this.isLoading.set(true);
        this.errorMessage.set('');
        await this.loadProcedures();
    }

    async loadProcedures() {
        try {
            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) return;

            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (!appUser) {
                this.errorMessage.set('ユーザー情報の取得に失敗しました');
                return;
            }

            const [procedures, employees] = await Promise.all([
                this.procedureService.getProcedures(),
                this.employeeService.getEmployeesByCompanyId(appUser.companyId),
            ]);

            const nameMap: Record<string, string> = {};
            for (const employee of employees) {
                nameMap[employee.id] = `${employee.lastName} ${employee.firstName}`;
            }
            this.employeeNameById.set(nameMap);

            this.procedures.set(
                procedures.filter((procedure) => procedure.companyId === appUser.companyId),
            );
        } catch (error) {
            console.error('手続きの取得に失敗しました', error);
            this.errorMessage.set('手続きの取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    setStatusFilter(filter: StatusFilter): void {
        this.statusFilter.set(filter);
    }

    tabCount(filter: StatusFilter): number {
        const procedures = this.procedures();
        switch (filter) {
            case 'action':
                return procedures.filter((p) => p.status !== 'completed').length;
            case 'notStarted':
                return procedures.filter((p) => p.status === 'notStarted').length;
            case 'inProgress':
                return procedures.filter((p) => p.status === 'inProgress').length;
            case 'completed':
                return procedures.filter((p) => p.status === 'completed').length;
            default:
                return procedures.length;
        }
    }

    subjectName(procedure: Procedure): string {
        return resolveProcedureSubjectName(procedure, this.employeeNameById());
    }

    isOverdue(procedure: Procedure): boolean {
        return isProcedureOverdue(procedure, this.today());
    }

    dueDateLabel(procedure: Procedure): string {
        if (!procedure.dueDate) return '期限未設定';
        return dateLabel(procedure.dueDate);
    }

    procedureSubtitle(procedure: Procedure): string {
        const parts: string[] = [];

        if (procedure.occurredDate) {
            parts.push(`発生日 ${dateLabel(procedure.occurredDate)}`);
        }
        if (procedure.targetYearMonth) {
            parts.push(`対象 ${procedure.targetYearMonth}`);
        }
        if (procedure.procedureType === 'dependentChange' && procedure.dependentChanges) {
            const labels = { add: '追加', change: '変更', delete: '削除' };
            parts.push(`異動: ${labels[procedure.dependentChanges]}`);
        }

        return parts.join(' ／ ') || '詳細を確認';
    }

    emptyMessage(): string {
        const status = this.statusFilter();
        if (status === 'action') return '対応が必要な手続きはありません';
        if (status === 'completed') return '完了した手続きはまだありません';
        if (this.typeFilter()) return '条件に一致する手続きがありません';
        return '手続きはまだありません';
    }

    private today(): string {
        return todayDateString();
    }
}
