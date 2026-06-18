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
import { resolveDependentChangeOccurredAndDueDate } from '../utils/procedure-due-date.util';
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
    PROCEDURE_SUBMIT_MISSING_FIELDS_MESSAGE,
} from '../utils/procedure-submit-validation.util';

type ChangeType = 'add' | 'change' | 'delete';

type DependentFormState = {
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

    procedureUpdated = output<Procedure>();
    dependentsUpdated = output<void>();

    changeType = signal<ChangeType | null>(null);
    form = signal<DependentFormState>(this.emptyForm());
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

    submitValidation = computed(() => {
        const type = this.changeType();
        if (!type) {
            return { ok: false as const, message: '異動の別を選択してください' };
        }
        return validateDependentProcedureSubmit(type, this.toSubmitForm(this.form()));
    });

    canSubmit = computed(() => this.submitValidation().ok);

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

    constructor() {
        effect(() => {
            const item = this.procedure();
            this.changeType.set(item.dependentChanges);
            if (item.dependentChanges) {
                this.form.set(this.formFromProcedure(item));
            }
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
        this.saveMessage.set('');
        this.saveErrorMessage.set('');
    }

    onDependentSelected(dependentId: string): void {
        if (!dependentId) {
            this.form.set(this.emptyForm());
            return;
        }

        const dependent = this.activeDependents().find((d) => d.id === dependentId);
        if (!dependent) return;

        this.form.set({
            ...this.emptyForm(),
            ...dependentToFormFields(dependent),
        });
    }

    async saveProcedure(): Promise<void> {
        if (this.isCompleted() || this.isSaving()) return;

        const type = this.changeType();
        if (!type) {
            this.saveErrorMessage.set(PROCEDURE_SUBMIT_MISSING_FIELDS_MESSAGE);
            return;
        }

        const validation = this.submitValidation();
        if (!validation.ok) {
            this.saveErrorMessage.set(PROCEDURE_SUBMIT_MISSING_FIELDS_MESSAGE);
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
        this.form.update((current) => ({ ...current, [key]: value }));
    }

    private emptyForm(): DependentFormState {
        return {
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
