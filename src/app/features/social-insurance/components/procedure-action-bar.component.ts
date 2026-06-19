import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Company } from '../../company/models/company.model';
import { Office } from '../../company/models/office.model';
import { Employee } from '../../employee/models/employee.models';
import { Procedure } from '../models/procedures.model';
import { downloadCsv } from '../../../shared/components/utils/csv.utils';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { dateLabel } from '../utils/procedure-display.util';
import {
    buildProcedureCsvExport,
    canExportProcedureCsv,
    ProcedureCsvExportContext,
} from '../utils/procedure-csv-export.util';
import {
    ProcedureSubmitMissingField,
    ProcedureSubmitValidationResult,
} from '../utils/procedure-submit-validation.util';

@Component({
    selector: 'app-procedure-action-bar',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './procedure-action-bar.component.html',
})
export class ProcedureActionBarComponent {
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly confirmService = inject(ConfirmService);
    private readonly router = inject(Router);

    procedure = input.required<Procedure>();
    employee = input<Employee | null>(null);
    office = input<Office | null>(null);
    company = input<Company | null>(null);
    /** CSV出力用。未指定時は procedure を使用 */
    procedureForExport = input<Procedure | null>(null);
    exportContext = input<ProcedureCsvExportContext>({});
    isSubmitting = input(false);
    isSavingDraft = input(false);
    showDraftSave = input(false);
    canSaveDraft = input(true);
    submitValidation = input<ProcedureSubmitValidationResult>({ ok: true });
    actionErrorMessage = input('');

    submitClick = output<void>();
    draftClick = output<void>();

    exportMessage = signal('');
    deleteErrorMessage = signal('');
    submitBlockedMessage = signal('');
    submitMissingFields = signal<ProcedureSubmitMissingField[]>([]);
    isDeleting = signal(false);

    readonly dateLabel = dateLabel;

    isCompleted = computed(() => this.procedure().status === 'completed');

    canExportCsv = computed(() => canExportProcedureCsv(this.procedure().procedureType));

    canDelete = computed(() => !this.isCompleted());

    submittedDateLabel(): string {
        const item = this.procedure();
        return dateLabel(item.submittedDate || item.completedDate);
    }

    onExportCsv(): void {
        this.exportMessage.set('');

        const result = buildProcedureCsvExport({
            procedure: this.procedure(),
            company: this.company(),
            office: this.office(),
            employee: this.employee(),
            procedureForExport: this.procedureForExport(),
            context: this.exportContext(),
        });

        if (!result.ok) {
            this.exportMessage.set(result.error);
            return;
        }

        downloadCsv(result.csvText, result.fileName);
        this.exportMessage.set('CSVを出力しました');
    }

    onDraftSave(): void {
        if (
            this.isCompleted()
            || this.isDeleting()
            || this.isSubmitting()
            || this.isSavingDraft()
            || !this.canSaveDraft()
        ) {
            return;
        }

        this.draftClick.emit();
    }

    async onSubmit(): Promise<void> {
        if (this.isCompleted() || this.isDeleting() || this.isSubmitting() || this.isSavingDraft()) {
            return;
        }

        const validation = this.submitValidation();
        if (!validation.ok) {
            this.submitBlockedMessage.set(validation.message);
            this.submitMissingFields.set(validation.missingFields ?? []);
            return;
        }

        this.submitBlockedMessage.set('');
        this.submitMissingFields.set([]);

        const confirmed = await this.confirmService.confirmSubmit();
        if (!confirmed) return;

        this.submitClick.emit();
    }

    navigateToMissingField(field: ProcedureSubmitMissingField, event: Event): void {
        event.preventDefault();
        event.stopPropagation();

        if (field.routerLink) {
            void this.router.navigate(Array.isArray(field.routerLink) ? field.routerLink : [field.routerLink], {
                fragment: field.fragment,
                queryParams: field.queryParams,
            });
            return;
        }

        if (field.fragment) {
            void this.router.navigate([], {
                fragment: field.fragment,
                queryParams: field.queryParams,
                queryParamsHandling: 'merge',
            });
            queueMicrotask(() => {
                document.getElementById(field.fragment!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }

    async onDelete(): Promise<void> {
        if (!this.canDelete() || this.isDeleting() || this.isSubmitting()) return;

        const confirmed = await this.confirmService.confirmDelete();
        if (!confirmed) return;

        this.isDeleting.set(true);
        this.deleteErrorMessage.set('');

        try {
            await this.procedureService.deleteProcedure(this.procedure().id);
            await this.router.navigate(['/procedures']);
        } catch (error) {
            console.error('手続きの削除に失敗しました', error);
            const msg = error instanceof Error ? error.message : '手続きの削除に失敗しました';
            this.deleteErrorMessage.set(msg);
        } finally {
            this.isDeleting.set(false);
        }
    }
}
