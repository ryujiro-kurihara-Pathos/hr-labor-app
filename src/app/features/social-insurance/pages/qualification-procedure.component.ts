import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Procedure } from '../models/procedures.model';
import { SocialInsuranceStatus } from '../models/social-insurance-status.model';
import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { StandardMonthlyReward } from '../../insurance/models/standard-monthly-reward.model';
import { Employee } from '../../employee/models/employee.models';
import { Office } from '../../company/models/office.model';
import { Company } from '../../company/models/company.model';
import { SocialInsuranceProcedureService } from '../services/social-insurance-procedure.service';
import { ProcedureActionBarComponent } from '../components/procedure-action-bar.component';
import { splitOfficeSymbol } from '../../company/utils/office-format.util';
import {
    dateLabel,
    employeeAddressLabel,
    procedureStatusLabel,
} from '../utils/procedure-display.util';
import {
    formatYen,
    QualificationMonthlyReward,
    resolveQualificationMonthlyReward,
} from '../utils/qualification-reward.util';
import {
    buildQualificationProcedureData,
    hasSavedQualificationData,
    monthlyRewardFromProcedure,
    resolveLiveQualificationDisplayDate,
    todayDateString,
} from '../utils/qualification-procedure-data.util';
import { validateQualificationProcedureSubmit } from '../utils/procedure-submit-validation.util';

@Component({
    selector: 'app-qualification-procedure',
    standalone: true,
    imports: [ProcedureActionBarComponent, RouterLink],
    templateUrl: './qualification-procedure.component.html',
})
export class QualificationProcedureComponent {
    private readonly procedureService = inject(SocialInsuranceProcedureService);

    procedure = input.required<Procedure>();
    employee = input<Employee | null>(null);
    office = input<Office | null>(null);
    company = input<Company | null>(null);
    socialInsuranceStatus = input<SocialInsuranceStatus | null>(null);
    hasDependents = input(false);
    joinMonthReward = input<StandardMonthlyReward | null>(null);
    employeeBonuses = input<BonusReward[]>([]);

    procedureUpdated = output<Procedure>();

    isSubmitting = signal(false);
    submitErrorMessage = signal('');

    isCompleted = computed(() => this.procedure().status === 'completed');

    useSavedData = computed(() => {
        const item = this.procedure();
        return item.status === 'completed' && hasSavedQualificationData(item);
    });

    liveQualificationDate = computed((): string | null => {
        const employee = this.employee();
        const status = this.socialInsuranceStatus();
        const item = this.procedure();
        return resolveLiveQualificationDisplayDate(
            employee,
            status?.healthInsuranceStartDate,
            item,
        );
    });

    liveMonthlyReward = computed(() => {
        const employee = this.employee();
        if (!employee) return null;
        return resolveQualificationMonthlyReward(
            employee.joinedDate,
            this.joinMonthReward(),
            this.employeeBonuses(),
            employee.employmentType,
        );
    });

    displayQualificationDate = computed((): string | null => {
        const item = this.procedure();
        if (this.useSavedData() && item.qualificationDate) return item.qualificationDate;
        return this.liveQualificationDate();
    });

    displayMonthlyReward = computed((): QualificationMonthlyReward | null => {
        const employee = this.employee();
        if (this.useSavedData()) {
            return monthlyRewardFromProcedure(this.procedure(), employee?.employmentType ?? null);
        }
        return this.liveMonthlyReward();
    });

    displayOfficeSymbol = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.officeSymbol;
        return this.office()?.officeSymbol ?? '';
    });

    displayOfficeNumber = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.officeNumber;
        return this.office()?.officeNumber ?? '';
    });

    displayCompanyName = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.companyName;
        return this.company()?.name ?? '';
    });

    displayOfficeName = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.officeName;
        return this.office()?.name ?? '';
    });

    displayOfficeAddress = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.officeAddress;
        const office = this.office();
        if (!office) return '—';
        const parts = [
            office.postalCode ? `〒${office.postalCode}` : '',
            office.prefecture,
            office.city,
            office.streetAddress,
            office.buildingName,
        ].filter((part) => part.trim());
        return parts.length > 0 ? parts.join(' ') : '—';
    });

    displayRepresentativeName = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.representativeName;
        return this.company()?.representativeName ?? '';
    });

    displayPhoneNumber = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.phoneNumber;
        return this.office()?.phoneNumber ?? '';
    });

    displayEmployeeLastName = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.employeeLastName;
        return this.employee()?.lastName ?? '';
    });

    displayEmployeeFirstName = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.employeeFirstName;
        return this.employee()?.firstName ?? '';
    });

    displayEmployeeLastNameKana = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.employeeLastNameKana;
        return this.employee()?.lastNameKana ?? '';
    });

    displayEmployeeFirstNameKana = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.employeeFirstNameKana;
        return this.employee()?.firstNameKana ?? '';
    });

    displayBirthDate = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.birthDate;
        return this.employee()?.birthDate ?? '';
    });

    displayMyNumber = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.myNumber;
        return this.employee()?.myNumber ?? '';
    });

    displayInsuredPersonNumber = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.insuredPersonNumber.trim();
        return this.employee()?.insuredPersonNumber.trim() ?? '';
    });

    displayEmployeeAddress = computed((): string => {
        const item = this.procedure();
        if (this.useSavedData()) return item.employeeAddress;
        const employee = this.employee();
        return employee ? employeeAddressLabel(employee) : '—';
    });

    displayHasDependents = computed((): boolean => {
        const item = this.procedure();
        if (this.useSavedData()) return item.hasDependents;
        return this.hasDependents();
    });

    submitValidation = computed(() =>
        validateQualificationProcedureSubmit({
            employee: this.employee(),
            office: this.office(),
            company: this.company(),
            qualificationDate: this.liveQualificationDate(),
            monthlyReward: this.liveMonthlyReward(),
        }),
    );

    canSubmit = computed(() => this.submitValidation().ok);

    exportProcedure = computed((): Procedure => {
        const item = this.procedure();
        const reward = this.displayMonthlyReward();

        return {
            ...item,
            qualificationDate: this.displayQualificationDate() ?? '',
            insuredPersonNumber: this.displayInsuredPersonNumber(),
            hasDependents: this.displayHasDependents(),
            rewardCashAmount: reward?.cashAmount ?? item.rewardCashAmount,
            rewardInKindAmount: reward?.inKindAmount ?? item.rewardInKindAmount,
            rewardTotalAmount: reward?.totalAmount ?? item.rewardTotalAmount,
        };
    });

    readonly statusLabel = procedureStatusLabel;
    readonly dateLabel = dateLabel;
    readonly formatYen = formatYen;

    officeSymbolPrefixChars(): string[] {
        return splitOfficeSymbol(this.displayOfficeSymbol()).prefix;
    }

    officeSymbolSuffixChars(): string[] {
        return splitOfficeSymbol(this.displayOfficeSymbol()).suffix;
    }

    convertJoinedDateToYearMonth(date: string): string {
        const [year, month] = date.split('-');
        return `${year}-${month}`;
    }

    async submitProcedure(): Promise<void> {
        if (this.isCompleted() || this.isSubmitting()) return;

        const validation = this.submitValidation();
        if (!validation.ok) return;

        const employee = this.employee();
        const office = this.office();
        const company = this.company();
        if (!employee || !office || !company) {
            this.submitErrorMessage.set('関連情報の取得に失敗したため、提出済みにできません');
            return;
        }

        const item = this.procedure();
        this.isSubmitting.set(true);
        this.submitErrorMessage.set('');

        try {
            const submittedDate = todayDateString();
            const procedureData = buildQualificationProcedureData({
                employee,
                office,
                company,
                qualificationDate: this.liveQualificationDate(),
                monthlyReward: this.liveMonthlyReward(),
                hasDependents: this.hasDependents(),
            });

            const insuredPersonNumber = await this.procedureService.completeQualificationProcedure(
                item.id,
                procedureData,
                submittedDate,
                employee.id,
            );

            this.procedureUpdated.emit({
                ...item,
                ...procedureData,
                insuredPersonNumber,
                status: 'completed',
                completedDate: submittedDate,
                submittedDate,
            });
        } catch (error) {
            console.error('手続きの提出済み処理に失敗しました', error);
            this.submitErrorMessage.set('提出済みにする処理に失敗しました');
        } finally {
            this.isSubmitting.set(false);
        }
    }
}
