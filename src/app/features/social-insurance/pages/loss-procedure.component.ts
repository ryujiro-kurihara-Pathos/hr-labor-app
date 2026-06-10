import { Component, computed, input } from '@angular/core';

import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';
import { Procedure } from '../models/procedures.model';
import { SocialInsuranceStatus } from '../models/social-insurance-status.model';
import { splitOfficeSymbol } from '../../company/utils/office-format.util';
import {
    dateLabel,
    genderLabel,
    lossReasonLabel,
    procedureStatusLabel,
    resolveLossDate,
    timestampDateLabel,
} from '../utils/procedure-display.util';

@Component({
    selector: 'app-loss-procedure',
    standalone: true,
    imports: [],
    templateUrl: './loss-procedure.component.html',
})
export class LossProcedureComponent {
    procedure = input.required<Procedure>();
    employee = input.required<Employee>();
    office = input.required<Office>();
    company = input.required<Company>();
    socialInsuranceStatus = input<SocialInsuranceStatus | null>(null);

    lossDate = computed(() => {
        const status = this.socialInsuranceStatus();
        return resolveLossDate(
            status?.healthInsuranceEndDate,
            status?.pensionInsuranceEndDate,
            this.procedure().occurredDate,
        );
    });

    showRetiredDate = computed(() => {
        const reason = this.procedure().lossReason;
        return reason === 'retirement' || reason === null;
    });

    readonly statusLabel = procedureStatusLabel;
    readonly genderLabel = genderLabel;
    readonly dateLabel = dateLabel;
    readonly lossReasonLabel = lossReasonLabel;
    readonly timestampDateLabel = timestampDateLabel;

    officeSymbolPrefixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).prefix;
    }

    officeSymbolSuffixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).suffix;
    }
}
