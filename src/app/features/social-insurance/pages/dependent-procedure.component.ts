import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Procedure } from '../models/procedures.model';
import {
    DEPENDENT_ADD_REASON_LABELS,
    DEPENDENT_DELETE_REASON_LABELS,
    DependentAddReason,
    DependentDeleteReason,
} from '../models/procedures.model';
import { Dependent, Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';
import { SocialInsuranceStatus } from '../models/social-insurance-status.model';
import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { ProcedureActionBarComponent } from '../components/procedure-action-bar.component';
import { EmployeeService } from '../../employee/services/employee.service';
import { splitOfficeSymbol } from '../../company/utils/office-format.util';
import {
    dateLabel,
    genderLabel,
    procedureStatusLabel,
    todayDateString,
} from '../utils/procedure-display.util';
import { resolveDependentChangeOccurredAndDueDate, procedureDueDateFromOccurredDate } from '../utils/procedure-due-date.util';
import {
    dependentAddReasonLabel,
    dependentChangeTypeLabel,
    dependentDeleteReasonLabel,
    dependentDisplayName,
    dependentRelationshipLabel,
    dependentToFormFields,
    extractDependentProcedureData,
    hasSavedDependentData,
} from '../utils/dependent-procedure-data.util';
import {
    DependentProcedureSubmitForm,
    validateDependentProcedureSubmit,
} from '../utils/procedure-submit-validation.util';
import {
    resolveDependentOccurredDateBounds,
    resolveInsuredPeriodBounds,
} from '../utils/procedure-date-range.util';

type ChangeType = 'add' | 'change' | 'delete';

type DependentFormState = {
    occurredDate: string;
    dependentId: string;
    lastName: string;
    firstName: string;
    birthDate: string;
    gender: 'male' | 'female' | '';
    relationship: Dependent['relationship'] | '';
    myNumber: string;
    address: string;
    occupation: string;
    income: number | '';
    dependencyStartDate: string;
    addReason: DependentAddReason | '';
    dependencyEndDate: string;
    deleteReason: DependentDeleteReason | '';
};

@Component({
    selector: 'app-dependent-procedure',
    standalone: true,
    imports: [FormsModule, DecimalPipe, ProcedureActionBarComponent],
    templateUrl: './dependent-procedure.component.html',
})
export class DependentProcedureComponent {
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly employeeService = inject(EmployeeService);

    procedure = input.required<Procedure>();
    employee = input.required<Employee>();
    office = input.required<Office>();
    company = input.required<Company>();
    dependents = input<Dependent[]>([]);
    socialInsuranceStatus = input<SocialInsuranceStatus | null>(null);

    procedureUpdated = output<Procedure>();
    dependentsUpdated = output<void>();

    changeType = signal<ChangeType | null>(null);
    form = signal<DependentFormState>(this.emptyForm());
    baselineForm = signal<DependentFormState | null>(null);
    isSaving = signal(false);
    saveMessage = signal('');
    saveErrorMessage = signal('');

    readonly statusLabel = procedureStatusLabel;
    readonly genderLabel = genderLabel;
    readonly dateLabel = dateLabel;
    readonly dependentChangeTypeLabel = dependentChangeTypeLabel;
    readonly dependentRelationshipLabel = dependentRelationshipLabel;
    readonly dependentAddReasonLabel = dependentAddReasonLabel;
    readonly dependentDeleteReasonLabel = dependentDeleteReasonLabel;
    readonly dependentDisplayName = dependentDisplayName;

    readonly addReasonOptions = Object.entries(DEPENDENT_ADD_REASON_LABELS) as [DependentAddReason, string][];
    readonly deleteReasonOptions = Object.entries(DEPENDENT_DELETE_REASON_LABELS) as [
        DependentDeleteReason,
        string,
    ][];

    isCompleted = computed(() => this.procedure().status === 'completed');
    useSavedData = computed(() => hasSavedDependentData(this.procedure()));

    activeDependents = computed(() => this.dependents().filter((d) => d.status === 'active'));

    displayData = computed(() => extractDependentProcedureData(this.procedure()));

    selectedDependent = computed(() => {
        const dependentId = this.form().dependentId;
        if (!dependentId) return null;
        return this.dependents().find((dependent) => dependent.id === dependentId) ?? null;
    });

    insuredPeriodBounds = computed(() =>
        resolveInsuredPeriodBounds({
            employee: this.employee(),
            healthInsuranceStartDate: this.socialInsuranceStatus()?.healthInsuranceStartDate,
            healthInsuranceEndDate: this.socialInsuranceStatus()?.healthInsuranceEndDate,
        }),
    );

    occurredDateBounds = computed(() =>
        resolveDependentOccurredDateBounds({
            changeType: this.changeType(),
            bounds: this.insuredPeriodBounds(),
            dependent: this.selectedDependent(),
        }),
    );

    submitValidation = computed(() => {
        const changeType = this.changeType();
        const form = this.form();
        const selected = this.selectedDependent();
        const status = this.socialInsuranceStatus();

        const validation = validateDependentProcedureSubmit(
            changeType,
            this.toSubmitForm(form),
            this.procedure().id,
            {
                employee: this.employee(),
                healthInsuranceStartDate: status?.healthInsuranceStartDate,
                healthInsuranceEndDate: status?.healthInsuranceEndDate,
                dependencyStartDate: selected?.dependencyStartDate ?? null,
                dependencyEndDate: selected?.dependencyEndDate ?? null,
            },
        );
        if (!validation.ok) return validation;

        if (changeType === 'change' && !this.hasDependentInfoChanges()) {
            return { ok: false as const, message: '変更がありません' };
        }

        return { ok: true as const };
    });

    canSubmit = computed(() => this.submitValidation().ok);

    previewDueDate = computed(() => {
        const occurredDate = this.form().occurredDate.trim();
        if (!occurredDate) return null;
        const dueDate = procedureDueDateFromOccurredDate(occurredDate);
        return dueDate || null;
    });

    exportProcedure = computed((): Procedure => {
        const item = this.procedure();
        if (this.useSavedData()) return item;

        const form = this.form();
        const type = this.changeType();
        if (!type) return item;

        return {
            ...item,
            dependentChanges: type,
            dependentId: form.dependentId || null,
            dependentLastName: form.lastName,
            dependentFirstName: form.firstName,
            dependentBirthDate: form.birthDate,
            dependentGender: form.gender,
            dependentRelationship: form.relationship,
            dependentMyNumber: form.myNumber,
            dependentAddress: form.address,
            dependentOccupation: form.occupation,
            dependentIncome: form.income === '' ? null : Number(form.income),
            dependencyStartDate: type === 'delete' ? '' : form.dependencyStartDate,
            dependentAddReason: type === 'add' ? form.addReason : '',
            dependencyEndDate: type === 'delete' ? form.dependencyEndDate : '',
            dependentDeleteReason: type === 'delete' ? form.deleteReason : '',
        };
    });

    exportDependent = computed((): Dependent | null => {
        const item = this.procedure();
        if (this.useSavedData()) {
            return {
                id: item.dependentId ?? '',
                lastName: item.dependentLastName,
                firstName: item.dependentFirstName,
                birthDate: item.dependentBirthDate,
                relationship: (item.dependentRelationship as Dependent['relationship']) || 'other',
                dependencyStartDate: item.dependencyStartDate,
                dependencyEndDate: item.dependencyEndDate || null,
                status: item.dependentChanges === 'delete' ? 'ended' : 'active',
                memo: '',
                gender: item.dependentGender as Dependent['gender'],
                myNumber: item.dependentMyNumber,
                address: item.dependentAddress,
                occupation: item.dependentOccupation,
                income: item.dependentIncome,
            };
        }

        const form = this.form();
        if (!form.lastName.trim() && !form.firstName.trim()) return null;

        return {
            id: form.dependentId,
            lastName: form.lastName,
            firstName: form.firstName,
            birthDate: form.birthDate,
            relationship: (form.relationship as Dependent['relationship']) || 'other',
            dependencyStartDate: form.dependencyStartDate,
            dependencyEndDate: form.dependencyEndDate || null,
            status: this.changeType() === 'delete' ? 'ended' : 'active',
            memo: '',
            gender: form.gender || undefined,
            myNumber: form.myNumber,
            address: form.address,
            occupation: form.occupation,
            income: form.income === '' ? null : Number(form.income),
        };
    });

    private initializedProcedureId: string | null = null;

    constructor() {
        effect(() => {
            const item = this.procedure();
            if (this.initializedProcedureId === item.id) return;

            this.initializedProcedureId = item.id;
            this.changeType.set(item.dependentChanges);
            if (item.dependentChanges) {
                this.form.set(this.formFromProcedure(item));
            } else {
                this.form.set({
                    ...this.emptyForm(),
                    occurredDate: item.occurredDate ?? '',
                });
            }
            this.baselineForm.set(null);
        });

        effect(() => {
            this.dependents();
            this.syncBaselineForSelectedDependent();
        });
    }

    officeSymbolPrefixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).prefix;
    }

    officeSymbolSuffixChars(): string[] {
        return splitOfficeSymbol(this.office().officeSymbol).suffix;
    }

    selectChangeType(type: ChangeType): void {
        if (this.isCompleted()) return;
        this.changeType.set(type);
        this.form.set(this.emptyForm());
        this.baselineForm.set(null);
        this.saveMessage.set('');
        this.saveErrorMessage.set('');
    }

    onDependentSelected(dependentId: string): void {
        const occurredDate = this.form().occurredDate;

        if (!dependentId) {
            this.form.set({ ...this.emptyForm(), occurredDate });
            this.baselineForm.set(null);
            return;
        }

        const dependent = this.activeDependents().find((d) => d.id === dependentId);
        if (!dependent) return;

        const baseline = {
            ...this.emptyForm(),
            ...dependentToFormFields(dependent),
        };
        this.baselineForm.set(baseline);
        this.form.set({
            ...baseline,
            occurredDate,
        });
    }

    async saveProcedure(): Promise<void> {
        if (this.isCompleted() || this.isSaving()) return;

        const validation = this.submitValidation();
        if (!validation.ok) return;

        const type = this.changeType();
        if (!type) return;

        if (!this.hasDependentInfoChanges()) {
            this.saveErrorMessage.set('変更がありません');
            return;
        }

        const item = this.procedure();
        const form = this.form();
        this.isSaving.set(true);
        this.saveErrorMessage.set('');
        this.saveMessage.set('');

        try {
            const employeeId = item.employeeId;
            if (!employeeId) {
                this.saveErrorMessage.set('従業員情報が見つかりません');
                return;
            }

            let dependentId = form.dependentId || null;

            if (type === 'add') {
                const created = await this.employeeService.createDependent(employeeId, {
                    lastName: form.lastName.trim(),
                    firstName: form.firstName.trim(),
                    birthDate: form.birthDate,
                    relationship: form.relationship as Dependent['relationship'],
                    dependencyStartDate: form.dependencyStartDate,
                    dependencyEndDate: null,
                    status: 'active',
                    gender: form.gender as 'male' | 'female',
                    myNumber: form.myNumber,
                    address: form.address,
                    occupation: form.occupation,
                    income: form.income === '' ? null : Number(form.income),
                    memo: form.addReason ? dependentAddReasonLabel(form.addReason) : '',
                });
                dependentId = created.id;
            } else if (type === 'change') {
                await this.employeeService.updateDependent(employeeId, form.dependentId, {
                    lastName: form.lastName.trim(),
                    firstName: form.firstName.trim(),
                    birthDate: form.birthDate,
                    relationship: form.relationship as Dependent['relationship'],
                    dependencyStartDate: form.dependencyStartDate,
                    gender: form.gender as 'male' | 'female',
                    myNumber: form.myNumber,
                    address: form.address,
                    occupation: form.occupation,
                    income: form.income === '' ? null : Number(form.income),
                });
            } else {
                await this.employeeService.endDependent(
                    employeeId,
                    form.dependentId,
                    form.dependencyEndDate,
                    form.deleteReason ? dependentDeleteReasonLabel(form.deleteReason) : undefined,
                );
            }

            const submittedDate = todayDateString();
            const procedureDates = resolveDependentChangeOccurredAndDueDate({
                changeType: type,
                occurredDate: form.occurredDate,
                dependencyStartDate: form.dependencyStartDate,
                dependencyEndDate: form.dependencyEndDate,
            });
            const updated: Procedure = {
                ...item,
                status: 'completed',
                completedDate: submittedDate,
                submittedDate,
                occurredDate: procedureDates?.occurredDate ?? item.occurredDate,
                dueDate: procedureDates?.dueDate ?? item.dueDate,
                dependentChanges: type,
                dependentId,
                dependentLastName: form.lastName,
                dependentFirstName: form.firstName,
                dependentBirthDate: form.birthDate,
                dependentGender: form.gender,
                dependentRelationship: form.relationship,
                dependentMyNumber: form.myNumber,
                dependentAddress: form.address,
                dependentOccupation: form.occupation,
                dependentIncome: form.income === '' ? null : Number(form.income),
                dependencyStartDate: type === 'delete' ? '' : form.dependencyStartDate,
                dependentAddReason: type === 'add' ? form.addReason : '',
                dependencyEndDate: type === 'delete' ? form.dependencyEndDate : '',
                dependentDeleteReason: type === 'delete' ? form.deleteReason : '',
            };

            await this.procedureService.updateProcedure(updated);
            this.procedureUpdated.emit(updated);
            this.dependentsUpdated.emit();
            this.saveMessage.set('提出済みにしました');
        } catch (error) {
            console.error('扶養変更届の保存に失敗しました', error);
            this.saveErrorMessage.set('保存に失敗しました');
        } finally {
            this.isSaving.set(false);
        }
    }

    updateForm<K extends keyof DependentFormState>(key: K, value: DependentFormState[K]): void {
        this.form.update((current) => {
            const next = { ...current, [key]: value };
            if (key === 'dependencyStartDate' && value && !current.occurredDate) {
                next.occurredDate = String(value);
            }
            if (key === 'dependencyEndDate' && value && !current.occurredDate) {
                next.occurredDate = String(value);
            }
            return next;
        });

        if (
            !this.isCompleted()
            && (key === 'occurredDate' || key === 'dependencyStartDate' || key === 'dependencyEndDate')
        ) {
            void this.syncProcedureDatesIfNeeded();
        }
    }

    private async syncProcedureDatesIfNeeded(): Promise<void> {
        const item = this.procedure();
        const type = this.changeType();
        if (!type || item.status === 'completed') return;

        const form = this.form();
        const procedureDates = resolveDependentChangeOccurredAndDueDate({
            changeType: type,
            occurredDate: form.occurredDate,
            dependencyStartDate: form.dependencyStartDate,
            dependencyEndDate: form.dependencyEndDate,
        });
        if (!procedureDates) return;

        if (
            item.occurredDate === procedureDates.occurredDate
            && item.dueDate === procedureDates.dueDate
        ) {
            return;
        }

        const updated: Procedure = {
            ...item,
            occurredDate: procedureDates.occurredDate,
            dueDate: procedureDates.dueDate,
        };

        try {
            await this.procedureService.updateProcedure(updated);
            this.procedureUpdated.emit(updated);
        } catch (error) {
            console.error('届出期限の更新に失敗しました', error);
        }
    }

    private syncBaselineForSelectedDependent(): void {
        const type = this.changeType();
        const form = this.form();
        if (type !== 'change' || !form.dependentId) {
            this.baselineForm.set(null);
            return;
        }

        const dependent = this.activeDependents().find((d) => d.id === form.dependentId);
        if (!dependent) return;

        this.baselineForm.set({
            ...this.emptyForm(),
            ...dependentToFormFields(dependent),
        });
    }

    private hasDependentInfoChanges(): boolean {
        if (this.changeType() !== 'change') return true;

        const baseline = this.baselineForm();
        if (!baseline) return true;

        return !this.areDependentInfoEqual(this.form(), baseline);
    }

    private areDependentInfoEqual(a: DependentFormState, b: DependentFormState): boolean {
        return JSON.stringify(this.dependentInfoSnapshot(a)) === JSON.stringify(this.dependentInfoSnapshot(b));
    }

    private dependentInfoSnapshot(form: DependentFormState) {
        return {
            lastName: form.lastName.trim(),
            firstName: form.firstName.trim(),
            birthDate: form.birthDate,
            gender: form.gender,
            relationship: form.relationship,
            myNumber: form.myNumber.trim(),
            address: form.address.trim(),
            occupation: form.occupation.trim(),
            income: form.income === '' ? null : Number(form.income),
            dependencyStartDate: form.dependencyStartDate,
        };
    }

    private emptyForm(): DependentFormState {
        return {
            occurredDate: '',
            dependentId: '',
            lastName: '',
            firstName: '',
            birthDate: '',
            gender: '',
            relationship: '',
            myNumber: '',
            address: '',
            occupation: '',
            income: '',
            dependencyStartDate: '',
            addReason: '',
            dependencyEndDate: '',
            deleteReason: '',
        };
    }

    private formFromProcedure(procedure: Procedure): DependentFormState {
        return {
            occurredDate: procedure.occurredDate,
            dependentId: procedure.dependentId ?? '',
            lastName: procedure.dependentLastName,
            firstName: procedure.dependentFirstName,
            birthDate: procedure.dependentBirthDate,
            gender: (procedure.dependentGender as 'male' | 'female' | '') || '',
            relationship: (procedure.dependentRelationship as Dependent['relationship'] | '') || '',
            myNumber: procedure.dependentMyNumber,
            address: procedure.dependentAddress,
            occupation: procedure.dependentOccupation,
            income: procedure.dependentIncome ?? '',
            dependencyStartDate: procedure.dependencyStartDate,
            addReason: procedure.dependentAddReason,
            dependencyEndDate: procedure.dependencyEndDate,
            deleteReason: procedure.dependentDeleteReason,
        };
    }

    private toSubmitForm(form: DependentFormState): DependentProcedureSubmitForm {
        return {
            occurredDate: form.occurredDate,
            dependentId: form.dependentId,
            lastName: form.lastName,
            firstName: form.firstName,
            birthDate: form.birthDate,
            gender: form.gender,
            relationship: form.relationship,
            dependencyStartDate: form.dependencyStartDate,
            addReason: form.addReason,
            dependencyEndDate: form.dependencyEndDate,
            deleteReason: form.deleteReason,
        };
    }
}
