import { Component, input } from '@angular/core';

import { Procedure } from '../models/procedures.model';
import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import {
    dateLabel,
    procedureStatusLabel,
    procedureTypeLabel,
} from '../utils/procedure-display.util';

@Component({
    selector: 'app-procedure-common-info',
    standalone: true,
    templateUrl: './procedure-common-info.component.html',
})
export class ProcedureCommonInfoComponent {
    procedure = input.required<Procedure>();
    employee = input.required<Employee>();
    office = input.required<Office>();

    readonly dateLabel = dateLabel;
    readonly statusLabel = procedureStatusLabel;
    readonly procedureTypeLabel = procedureTypeLabel;
}
