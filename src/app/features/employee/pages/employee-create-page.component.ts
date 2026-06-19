import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { EmployeeInput, EmploymentType, createEmptyEmployeeInput, toEmployeeInput } from '../models/employee.models';
import { EmployeeService } from '../services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { SocialInsuranceProcedureService } from '../../social-insurance/services/social-insurance-procedure.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { OfficeService } from '../../company/services/office.service';
import { Office } from '../../company/models/office.model';
import { insuranceJoinStatus, SocialInsuranceStatusInput } from '../../social-insurance/models/social-insurance-status.model';
import {
    judgeHealthInsuranceJoinStatus,
    judgePensionInsuranceJoinStatus,
} from '../../social-insurance/utils/age-premium-period.util';
import { EmployeeInviteService } from '../../invitations/services/employee-invite.service';
import { normalizeAuthEmail } from '../../auth/utils/email-link-auth.util';
import { PostalCodeLookupService } from '../../../shared/services/postal-code-lookup.service';
import { applyPostalLookupResult } from '../../../shared/utils/postal-code-lookup.util';
import { StandardMonthlyRewardService } from '../../insurance/services/standard-monthly-reward.service';
import { buildJoinMonthExpectedRewardInput } from '../../insurance/utils/join-month-expected-reward.util';
import { katakanaValidationMessage, isKatakanaOnly } from '../utils/katakana.util';

const PREFECTURES = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県',
    '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県',
    '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

@Component({
    selector: 'app-employee-create-page',
    standalone: true,
    imports: [FormsModule, RouterLink],
    templateUrl: './employee-create-page.component.html',
})
export class EmployeeCreatePageComponent {
    private readonly employeeService = inject(EmployeeService);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly officeService = inject(OfficeService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);
    private readonly procedureService = inject(SocialInsuranceProcedureService);
    private readonly confirmService = inject(ConfirmService);
    private readonly employeeInviteService = inject(EmployeeInviteService);
    private readonly postalCodeLookupService = inject(PostalCodeLookupService);
    private readonly rewardService = inject(StandardMonthlyRewardService);

    isLoading = signal(false);
    isLoadingEmployee = signal(false);
    isPostalLookupLoading = signal(false);
    postalLookupError = signal('');
    errorMessage = signal('');
    lastNameKanaError = signal('');
    firstNameKanaError = signal('');
    nextEmployeeNumber = signal('');
    offices = signal<Office[]>([]);
    employee: EmployeeInput = createEmptyEmployeeInput();
    expectedMonthlySalary: number | '' = '';
    readonly prefectures = PREFECTURES;

    async ngOnInit(): Promise<void> {
        this.isLoading.set(true);

        const today = new Date();
        this.employee.joinedDate = this.toDateString(today);
        const birth = new Date(today);
        birth.setFullYear(birth.getFullYear() - 30);
        this.employee.birthDate = this.toDateString(birth);
        this.employee.myNumber = this.generateMyNumber();

        const authUser = this.authService.getCurrentAuthUser();
        if (!authUser) {
            this.isLoading.set(false);
            return;
        }

        const appUser = await this.userService.getUserByUid(authUser.uid);
        if (!appUser) {
            this.isLoading.set(false);
            return;
        }

        this.employee.companyId = appUser.companyId;
        await this.loadOffices(appUser.companyId);
        this.nextEmployeeNumber.set(
            await this.employeeService.generateNextEmployeeNumber(appUser.companyId),
        );
        this.isLoading.set(false);
    }

    async lookupAddressFromPostalCode(): Promise<void> {
        this.postalLookupError.set('');
        this.isPostalLookupLoading.set(true);

        try {
            const result = await this.postalCodeLookupService.lookup(this.employee.postalCode);
            applyPostalLookupResult(this.employee, result);
        } catch (error) {
            this.postalLookupError.set(this.postalCodeLookupService.toUserMessage(error));
        } finally {
            this.isPostalLookupLoading.set(false);
        }
    }

    async onCreateEmployee(): Promise<void> {
        this.isLoadingEmployee.set(true);
        this.errorMessage.set('');
        this.lastNameKanaError.set('');
        this.firstNameKanaError.set('');

        const lastNameKanaMessage = katakanaValidationMessage(this.employee.lastNameKana, '姓（カナ）');
        const firstNameKanaMessage = katakanaValidationMessage(this.employee.firstNameKana, '名（カナ）');
        if (lastNameKanaMessage) this.lastNameKanaError.set(lastNameKanaMessage);
        if (firstNameKanaMessage) this.firstNameKanaError.set(firstNameKanaMessage);

        if (
            this.isFormEmpty(this.employee.lastName)
            || this.isFormEmpty(this.employee.firstName)
            || this.isFormEmpty(this.employee.birthDate)
            || this.isFormEmpty(this.employee.joinedDate)
            || this.isFormEmpty(this.employee.officeId)
            || this.employee.employmentType === null
            || this.expectedMonthlySalary === ''
            || Number(this.expectedMonthlySalary) <= 0
            || lastNameKanaMessage
            || firstNameKanaMessage
        ) {
            if (!lastNameKanaMessage && !firstNameKanaMessage) {
                this.errorMessage.set('必須項目を入力してください。');
            }
            this.isLoadingEmployee.set(false);
            return;
        }

        try {
            this.employee.lastNameKana = this.employee.lastNameKana.trim();
            this.employee.firstNameKana = this.employee.firstNameKana.trim();
            this.employee.email = normalizeAuthEmail(this.employee.email);
            const employee = await this.employeeService.createEmployee(this.employee);
            if (!employee) return;

            const employmentStatus = this.resolveEmploymentJoinStatus(employee.employmentType);
            const socialInsuranceStatusInput: SocialInsuranceStatusInput = {
                employeeId: employee.id,
                weeklyScheduledWorkHours: null,
                monthlyScheduledWorkDays: null,
                prescribedWage: null,
                isStudent: false,
                expectedEmploymentOver2Months: false,
                healthInsuranceStatus: judgeHealthInsuranceJoinStatus(employmentStatus, employee.birthDate),
                pensionInsuranceStatus: judgePensionInsuranceJoinStatus(employmentStatus, employee.birthDate),
                careInsuranceStatus: 'unknown',
                healthInsuranceStartDate: null,
                healthInsuranceEndDate: null,
                pensionInsuranceStartDate: null,
                pensionInsuranceEndDate: null,
                careInsuranceStartDate: null,
                careInsuranceEndDate: null,
                memo: '',
            };
            const syncedSocialInsuranceInput = await this.socialInsuranceStatusService.withSyncedCareInsuranceDates(
                employee.id,
                socialInsuranceStatusInput,
                employee.birthDate,
                employmentStatus,
            );
            await this.socialInsuranceStatusService.createSocialInsuranceStatus(syncedSocialInsuranceInput);

            const expectedSalary = Number(this.expectedMonthlySalary);
            const joinMonthRewardInput = buildJoinMonthExpectedRewardInput({
                companyId: employee.companyId,
                employeeId: employee.id,
                joinedDate: employee.joinedDate,
                employmentType: employee.employmentType,
                expectedMonthlySalary: expectedSalary,
            });
            if (joinMonthRewardInput) {
                await this.rewardService.saveDraft(joinMonthRewardInput);
            }

            await this.procedureService.syncQualificationProcedureForEmployee({
                employee,
                healthInsuranceStartDate: null,
                healthInsuranceStatus: syncedSocialInsuranceInput.healthInsuranceStatus,
                pensionInsuranceStatus: syncedSocialInsuranceInput.pensionInsuranceStatus,
            });

            const inviteEmail = await this.confirmService.confirmInviteEmail(this.employee.email);
            let inviteSuccessMessage = '';

            if (inviteEmail) {
                let employeeForInvite = employee;
                if (employee.email !== inviteEmail) {
                    await this.employeeService.updateEmployee(
                        employee.id,
                        toEmployeeInput(employee, { email: inviteEmail }),
                    );
                    employeeForInvite = { ...employee, email: inviteEmail };
                }

                try {
                    await this.employeeInviteService.sendInvitation(employeeForInvite, inviteEmail);
                    inviteSuccessMessage = `${inviteEmail} 宛に招待メールを送信しました`;
                } catch (error) {
                    console.error('招待メールの送信に失敗しました', error);
                    inviteSuccessMessage = this.employeeInviteService.toUserMessage(error);
                }
            }

            await this.router.navigate(['/employees', employee.id], {
                queryParams: inviteSuccessMessage ? { inviteMsg: inviteSuccessMessage } : {},
            });
        } catch (error) {
            this.errorMessage.set('従業員の追加に失敗しました。');
            console.error('従業員の追加に失敗しました。', error);
        } finally {
            this.isLoadingEmployee.set(false);
        }
    }

    onKanaFieldChange(field: 'lastNameKana' | 'firstNameKana'): void {
        const label = field === 'lastNameKana' ? '姓（カナ）' : '名（カナ）';
        const trimmed = this.employee[field].trim();
        const errorSignal = field === 'lastNameKana' ? this.lastNameKanaError : this.firstNameKanaError;

        if (!trimmed) {
            errorSignal.set('');
            return;
        }
        if (!isKatakanaOnly(trimmed)) {
            errorSignal.set(`${label}は全角カタカナで入力してください。`);
            return;
        }
        errorSignal.set('');
    }

    private async loadOffices(companyId: string): Promise<void> {
        try {
            const offices = await this.officeService.getActiveOfficesByCompanyId(companyId);
            this.offices.set(offices);
            if (offices.length > 0 && !this.employee.officeId) {
                this.employee.officeId = offices[0].id;
            }
        } catch (error) {
            console.error('事業所の取得に失敗しました', error);
            this.offices.set([]);
        }
    }

    private resolveEmploymentJoinStatus(employmentType: EmploymentType): insuranceJoinStatus {
        if (employmentType === 'full-time') return 'active';
        if (employmentType === 'part-time') return 'unknown';
        return 'unknown';
    }

    private generateMyNumber(): string {
        return Math.floor(Math.random() * 1_000_000_000_000).toString().padStart(12, '0');
    }

    private isFormEmpty(value: string): boolean {
        return value.trim() === '';
    }

    private toDateString(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
}
