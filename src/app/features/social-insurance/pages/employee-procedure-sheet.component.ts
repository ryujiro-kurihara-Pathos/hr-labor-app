import { Component, input } from '@angular/core';

import { Procedure } from '../models/procedures.model';
import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';
import { splitOfficeSymbol } from '../../company/utils/office-format.util';
import {
    dateLabel,
    genderLabel,
    procedureStatusLabel,
} from '../utils/procedure-display.util';

export type RemunerationProcedureVariant = 'regularDecision' | 'revision' | 'bonusPayment';

@Component({
    selector: 'app-employee-procedure-sheet',
    standalone: true,
    imports: [],
    templateUrl: './employee-procedure-sheet.component.html',
})
export class EmployeeProcedureSheetComponent {
    procedure = input.required<Procedure>();
    employee = input.required<Employee>();
    office = input.required<Office>();
    company = input.required<Company>();
    formTitle = input.required<string>();
    variant = input.required<RemunerationProcedureVariant>();

    readonly statusLabel = procedureStatusLabel;
    readonly genderLabel = genderLabel;
    readonly dateLabel = dateLabel;

    officeSymbolPrefixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).prefix;
    }

    officeSymbolSuffixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).suffix;
    }

    yearMonthLabel(value: string | null | undefined): string {
        if (!value) return '—';
        const [y, m] = value.split('-');
        if (!y || !m) return '—';
        return `${y}年${m}月`;
    }
}
