import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { EmployeeInput } from '../models/employee.models';
import { EmployeeService } from '../services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { SocialInsuranceStatusService } from '../../social-insurance/services/social-insurance-status.service';
import { OfficeService } from '../../company/services/office.service';
import { Office } from '../../company/models/office.model';
import { insuranceJoinStatus, SocialInsuranceStatusInput } from '../../social-insurance/models/social-insurance-status.model';

@Component({
    selector: 'app-employee-create-page',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './employee-create-page.component.html',
})

export class EmployeeCreatePageComponent {
    private readonly employeeService = inject(EmployeeService);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly officeService = inject(OfficeService);
    private readonly socialInsuranceStatusService = inject(SocialInsuranceStatusService);

    // ローディング
    isLoading = signal<boolean>(false);

    // 追加する従業員情報
    employee: EmployeeInput = {
        companyId: '',
        officeId: '',
        employeeNumber: '',
        lastName: '',
        firstName: '',
        birthDate: '',
        joinedDate: '',
        employmentType: null,
        department: '',
        position: '',
        status: 'active',
        retiredDate: null,
    };

    // 初期処理
    async ngOnInit() {
        this.isLoading.set(true);

        this.updateJoinedDate();
        this.updateBirthDate();

        // companyIdを取得
        const authUser = this.authService.getCurrentAuthUser();
        if (!authUser) return;
        const appUser = await this.userService.getUserByUid(authUser.uid);
        if (!appUser) return;
        this.employee.companyId = appUser.companyId;

        // 事業所のロード
        await this.loadOffices(this.employee.companyId);

        this.isLoading.set(false);
    }

    // 入社日
    joinedYear = new Date().getFullYear();
    joinedMonth = new Date().getMonth() + 1;
    joinedDay = new Date().getDate();
    readonly joinYears = Array.from({ length: 51 }, (_, i) => new Date().getFullYear() - 25 + i);
    // 入社日を更新
    updateJoinedDate(): void {
        const month = String(this.joinedMonth).padStart(2, '0');
        const day = String(this.joinedDay).padStart(2, '0');
        this.employee.joinedDate = `${this.joinedYear}-${month}-${day}`;
    }

    // 生年月日
    birthYear = new Date().getFullYear() - 30;
    birthMonth = 1;
    birthDay = 1;
    readonly birthYears = Array.from({ length: 101 }, (_, i) => new Date().getFullYear() - 100 + i);
    // 生年月日を更新
    updateBirthDate(): void {
        const month = String(this.birthMonth).padStart(2, '0');
        const day = String(this.birthDay).padStart(2, '0');
        this.employee.birthDate = `${this.birthYear}-${month}-${day}`;
    }

    // 事業所一覧
    offices = signal<Office[]>([]);

    // 事業所のロード
    async loadOffices(companyId: string): Promise<void> {
        try {
            const offices = await this.officeService.getOfficesByCompanyId(companyId);
            this.offices.set(offices);
        } catch (error) {
            console.error('事業所の取得に失敗しました', error);
            this.offices.set([]);
        }
    }

    // 従業員の追加ローディング
    isLoadingEmployee = signal<boolean>(false);
    errorMessage = signal<string>('');

    // 従業員を追加
    async onCreateEmployee() {

        this.isLoadingEmployee.set(true);
        this.errorMessage.set('');

        if(this.isFormEmpty(this.employee.lastName)
            || this.isFormEmpty(this.employee.firstName)
            || this.isFormEmpty(this.employee.birthDate)
            || this.isFormEmpty(this.employee.joinedDate)) {
            this.errorMessage.set('必須項目を入力してください。');
            this.isLoadingEmployee.set(false);
            return;
        }

        try {
            // 従業員を作成
            const employee = await this.employeeService.createEmployee(this.employee);

            // 介護保険の対象かの判定
            const birthDate = this.employee.birthDate;
            const careInsuranceStatus = this.judgeCareInsurance(birthDate);

            // 社会保険情報を作成
            const socialInsuranceStatusInput: SocialInsuranceStatusInput = {
                employeeId: employee.id,
                weeklyScheduledWorkHours: null,
                monthlyScheduledWorkDays: null,
                prescribedWage: null,
                isStudent: false,
                expectedEmploymentOver2Months: false,
                healthInsuranceStatus: 'unknown',   // 健康保険
                pensionInsuranceStatus: 'unknown',  // 厚生年金
                careInsuranceStatus: careInsuranceStatus,     // 介護保険
                healthInsuranceStartDate: null,     // 健康保険の資格取得日
                healthInsuranceEndDate: null,       // 健康保険の資格喪失日
                pensionInsuranceStartDate: null,    // 厚生年金の資格取得日
                pensionInsuranceEndDate: null,      // 厚生年金の資格喪失日
                careInsuranceStartDate: null,       // 介護保険の対象開始日
                careInsuranceEndDate: null,         // 介護保険の対象終了日
            }
            await this.socialInsuranceStatusService.createSocialInsuranceStatus(socialInsuranceStatusInput);

            // 従業員の追加成功
            this.errorMessage.set('');
            this.router.navigate(['/employees', employee.id]);
        } catch (error) {
            this.errorMessage.set('従業員の追加に失敗しました。');
            console.error('従業員の追加に失敗しました。', error);
        } finally {
            this.isLoadingEmployee.set(false);
        }
    }

    // フォームが空白かどうか
    isFormEmpty(value: string): boolean {
        return value.trim() === '';
    }

    // 厚生年金の対象かの判定
    judgeCareInsurance(birthDate: string): insuranceJoinStatus {
        const age = this.ageToday(birthDate);
        if (age === null) return 'unknown';
        // 参考ルール（簡易）：40歳以上65歳未満を対象
        return age >= 40 && age < 65 ? 'active' : 'inactive';
    }

    // 生年月日から年齢を計算する
    private ageToday(birthDate: string): number | null {
        if (!birthDate) return null;
        const d = new Date(birthDate);
        if (Number.isNaN(d.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
        return age;
    }
}