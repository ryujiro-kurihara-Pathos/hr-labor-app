import { Component, input } from '@angular/core';

import { Procedure } from '../models/procedures.model';
import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';
import { ProcedureCommonInfoComponent } from './procedure-common-info.component';
import { splitOfficeSymbol } from '../../company/utils/office-format.util';
import {
    dateLabel,
    genderLabel,
    procedureStatusLabel,
    procedureTypeLabel,
} from '../utils/procedure-display.util';

@Component({
    selector: 'app-dependent-procedure',
    standalone: true,
    imports: [ProcedureCommonInfoComponent],
    templateUrl: './dependent-procedure.component.html',
})

export class DependentProcedureComponent {
    procedure = input.required<Procedure>();
    employee = input.required<Employee>();
    office = input.required<Office>();
    company = input.required<Company>();

    readonly procedureTypeLabel = procedureTypeLabel;
    readonly statusLabel = procedureStatusLabel;
    readonly genderLabel = genderLabel;
    readonly dateLabel = dateLabel;

    officeSymbolPrefixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).prefix;
    }

    officeSymbolSuffixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).suffix;
    }
}
