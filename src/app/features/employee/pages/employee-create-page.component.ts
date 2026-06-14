import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { EmployeeInput, EmploymentType, createEmptyEmployeeInput } from '../models/employee.models';
import { EmployeeService } from '../services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { OfficeService } from '../../company/services/office.service';
import { Office } from '../../company/models/office.model';
import { insuranceJoinStatus, SocialInsuranceStatusInput } from '../../social-insurance/models/social-insurance-status.model';

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
    private readonly confirmService = inject(ConfirmService);

    isLoading = signal(false);
    isLoadingEmployee = signal(false);
    errorMessage = signal('');
    nextEmployeeNumber = signal('');
    offices = signal<Office[]>([]);
    employee: EmployeeInput = createEmptyEmployeeInput();
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

    async onCreateEmployee(): Promise<void> {
        this.isLoadingEmployee.set(true);
        this.errorMessage.set('');

        if (
            this.isFormEmpty(this.employee.lastName)
            || this.isFormEmpty(this.employee.firstName)
            || this.isFormEmpty(this.employee.birthDate)
            || this.isFormEmpty(this.employee.joinedDate)
            || this.isFormEmpty(this.employee.officeId)
        ) {
            this.errorMessage.set('必須項目を入力してください。');
            this.isLoadingEmployee.set(false);
            return;
        }

        try {
            const employee = await this.employeeService.createEmployee(this.employee);
            if (!employee) return;

            const socialInsuranceStatusInput: SocialInsuranceStatusInput = {
                employeeId: employee.id,
                weeklyScheduledWorkHours: null,
                monthlyScheduledWorkDays: null,
                prescribedWage: null,
                isStudent: false,
                expectedEmploymentOver2Months: false,
                healthInsuranceStatus: 'unknown',
                pensionInsuranceStatus: 'unknown',
                careInsuranceStatus: this.judgeCareInsurance(this.employee.birthDate, employee.employmentType),
                healthInsuranceStartDate: null,
                healthInsuranceEndDate: null,
                pensionInsuranceStartDate: null,
                pensionInsuranceEndDate: null,
                careInsuranceStartDate: null,
                careInsuranceEndDate: null,
                memo: '',
            };
            await this.socialInsuranceStatusService.createSocialInsuranceStatus(socialInsuranceStatusInput);

            const sendInviteEmail = await this.confirmService.confirmInviteEmail();
            await this.router.navigate(['/employees', employee.id], {
                queryParams: sendInviteEmail ? { invite: '1' } : {},
            });
        } catch (error) {
            this.errorMessage.set('従業員の追加に失敗しました。');
            console.error('従業員の追加に失敗しました。', error);
        } finally {
            this.isLoadingEmployee.set(false);
        }
    }

    private async loadOffices(companyId: string): Promise<void> {
        try {
            const offices = await this.officeService.getOfficesByCompanyId(companyId);
            this.offices.set(offices);
            if (offices.length > 0 && !this.employee.officeId) {
                this.employee.officeId = offices[0].id;
            }
        } catch (error) {
            console.error('事業所の取得に失敗しました', error);
            this.offices.set([]);
        }
    }

    private judgeCareInsurance(birthDate: string, employmentType: EmploymentType): insuranceJoinStatus {
        if (employmentType === 'part-time') return 'inactive';
        const age = this.ageToday(birthDate);
        if (age === null) return 'unknown';
        return age >= 40 && age < 65 ? 'active' : 'inactive';
    }

    private ageToday(birthDate: string): number | null {
        const d = new Date(birthDate);
        if (Number.isNaN(d.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
        return age;
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
