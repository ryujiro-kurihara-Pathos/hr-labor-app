import { Component, computed, input } from '@angular/core';

import { Procedure } from '../models/procedures.model';
import { SocialInsuranceStatus } from '../models/social-insurance-status.model';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { StandardMonthlyReward } from '../../insurance/models/standard-monthly-reward.model';
import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';
import { ProcedureCommonInfoComponent } from './procedure-common-info.component';
import { splitOfficeSymbol } from '../../company/utils/office-format.util';
import {
    dateLabel,
    employeeAddressLabel,
    procedureStatusLabel,
} from '../utils/procedure-display.util';
import {
    formatYen,
    resolveQualificationMonthlyReward,
} from '../utils/qualification-reward.util';

@Component({
    selector: 'app-qualification-procedure',
    standalone: true,
    imports: [ProcedureCommonInfoComponent],
    templateUrl: './qualification-procedure.component.html',
})
export class QualificationProcedureComponent {
    procedure = input.required<Procedure>();
    employee = input.required<Employee>();
    office = input.required<Office>();
    company = input.required<Company>();
    socialInsuranceStatus = input<SocialInsuranceStatus | null>(null);
    hasDependents = input(false);
    joinMonthReward = input<StandardMonthlyReward | null>(null);
    employeeBonuses = input<BonusReward[]>([]);

    qualificationDate = computed(() => {
        const status = this.socialInsuranceStatus();
        const item = this.procedure();
        return (
            status?.healthInsuranceStartDate ||
            item.occurredDate ||
            this.employee().joinedDate ||
            null
        );
    });

    monthlyReward = computed(() =>
        resolveQualificationMonthlyReward(
            this.employee().joinedDate,
            this.joinMonthReward(),
            this.employeeBonuses(),
        ),
    );

    readonly statusLabel = procedureStatusLabel;
    readonly dateLabel = dateLabel;
    readonly employeeAddressLabel = employeeAddressLabel;
    readonly formatYen = formatYen;

    officeSymbolPrefixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).prefix;
    }

    officeSymbolSuffixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).suffix;
    }
}
