import { Component, input } from '@angular/core';

import { Procedure, ProcedureStatus, ProcedureType } from '../models/procedures.model';
import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';
import { splitOfficeSymbol } from '../../company/utils/office-format.util';

@Component({
    selector: 'app-qualification-procedure',
    standalone: true,
    imports: [],
    templateUrl: './qualification-procedure.component.html',
})

export class QualificationProcedureComponent {
    procedure = input.required<Procedure>();
    employee = input.required<Employee>();
    office = input.required<Office>();
    company = input.required<Company>();

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

    genderLabel(gender: string | null | undefined): string {
        if (gender === null || gender === undefined) return '—';
        return gender === 'female' ? '女性' : '男性';
    }

    dateLabel(date: string | null | undefined): string {
        if (date === null || date === undefined) return '—';
        const y = date.split('-')[0];
        const m = date.split('-')[1];
        const d = date.split('-')[2];
        if (!y || !m || !d) return '—';
        return `${y}/${m}/${d}`;
    }

    officeSymbolPrefixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).prefix;
    }

    officeSymbolSuffixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).suffix;
    }
}
