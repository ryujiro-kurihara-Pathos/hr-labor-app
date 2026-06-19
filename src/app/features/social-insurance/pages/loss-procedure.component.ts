import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Timestamp } from 'firebase/firestore';

import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';
import { Procedure } from '../models/procedures.model';
import { SocialInsuranceStatus } from '../models/social-insurance-status.model';
import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { ProcedureActionBarComponent } from '../components/procedure-action-bar.component';
import { ProcedureDetailHeaderComponent } from '../components/procedure-detail-header.component';
import { splitOfficeSymbol } from '../../company/utils/office-format.util';
import {
    dateLabel,
    genderLabel,
    lossReasonLabel,
    procedureStatusLabel,
    resolveLossDate,
    timestampDateLabel,
} from '../utils/procedure-display.util';
import { validateLossProcedureSubmit } from '../utils/procedure-submit-validation.util';

@Component({
    selector: 'app-loss-procedure',
    standalone: true,
    imports: [ProcedureActionBarComponent, ProcedureDetailHeaderComponent],
    templateUrl: './loss-procedure.component.html',
})
export class LossProcedureComponent {
    private readonly procedureService = inject(SocialInsuranceProcedureService);

    procedure = input.required<Procedure>();
    employee = input.required<Employee>();
    office = input.required<Office>();
    company = input.required<Company>();
    socialInsuranceStatus = input<SocialInsuranceStatus | null>(null);

    procedureUpdated = output<Procedure>();

    isSubmitting = signal(false);
    submitErrorMessage = signal('');

    lossDate = computed(() => {
        const status = this.socialInsuranceStatus();
        const procedure = this.procedure();
        const employee = this.employee();
        return resolveLossDate(
            status?.healthInsuranceEndDate,
            status?.pensionInsuranceEndDate,
            procedure.occurredDate,
            {
                lossReason: procedure.lossReason,
                retiredDate: employee.retiredDate
                    ? this.retiredDateString(employee.retiredDate)
                    : null,
            },
        );
    });

    showRetiredDate = computed(() => {
        const reason = this.procedure().lossReason;
        return reason === 'retirement' || reason === null;
    });

    submitValidation = computed(() =>
        validateLossProcedureSubmit({
            employee: this.employee(),
            office: this.office(),
            company: this.company(),
            lossDate: this.lossDate(),
            lossReason: this.procedure().lossReason,
            healthInsuranceStartDate: this.socialInsuranceStatus()?.healthInsuranceStartDate,
        }),
    );

    canSubmit = computed(() => this.submitValidation().ok);

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

    private retiredDateString(retiredDate: Timestamp): string {
        const date = retiredDate.toDate();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    async submitProcedure(): Promise<void> {
        const item = this.procedure();
        if (item.status === 'completed' || this.isSubmitting()) return;

        const validation = this.submitValidation();
        if (!validation.ok) return;

        this.isSubmitting.set(true);
        this.submitErrorMessage.set('');

        try {
            const updated = await this.procedureService.markProcedureAsSubmitted(item);
            this.procedureUpdated.emit(updated);
        } catch (error) {
            console.error('手続きの提出済み処理に失敗しました', error);
            this.submitErrorMessage.set('提出済みにする処理に失敗しました');
        } finally {
            this.isSubmitting.set(false);
        }
    }
}
