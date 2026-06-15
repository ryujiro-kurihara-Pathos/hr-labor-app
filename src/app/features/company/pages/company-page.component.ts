import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import { Company, InsurancePremiumCollectionTiming } from '../models/company.model';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { CompanyService } from '../services/company.service';
import {
    formatPayrollClosingDayLabel,
    formatPayrollPaymentDayLabel,
    insurancePremiumCollectionTimingLabel,
    isValidPayrollDay,
} from '../utils/company-payroll-settings.util';

import { OfficeCreateModalComponent, OfficeFormData } from '../components/office-create-modal.component';
import { OfficeService } from '../services/office.service';
import { Office, OfficeCreateInput } from '../models/office.model';
import { formatOfficeAddress } from '../utils/office-format.util';
import { healthInsuranceTypeLabel } from '../utils/office-health-insurance.util';
import { extractPrefectureFromAddress } from '../utils/office-prefecture.util';
import { FieldHelpTooltipComponent } from '../../../shared/components/field-help-tooltip.component';

@Component({
    selector: 'app-company-page',
    standalone: true,
    imports: [RouterLink, FormsModule, OfficeCreateModalComponent, FieldHelpTooltipComponent],
    templateUrl: './company-page.component.html',
})

export class CompanyPageComponent {
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly companyService = inject(CompanyService);
    private readonly officeService = inject(OfficeService);
    private readonly router = inject(Router);

    //// 会社情報
    company = signal<Company | null>(null);

    isLoading = signal<boolean>(false);
    isSavingCompany = signal<boolean>(false);
    isEditingCompany = signal<boolean>(false);
    errorMessage = signal<string>('');

    companyName = '';
    representativeName = '';
    companyAddress = '';
    payrollClosingDay: number | '' = '';
    payrollPaymentDay: number | '' = '';
    payrollPaymentMonthOffset: 0 | 1 = 1;
    insurancePremiumCollectionTiming: InsurancePremiumCollectionTiming = 'next_month';

    readonly payrollDayOptions = Array.from({ length: 31 }, (_, index) => index + 1);
    readonly formatPayrollClosingDayLabel = formatPayrollClosingDayLabel;
    readonly formatPayrollPaymentDayLabel = formatPayrollPaymentDayLabel;
    readonly insurancePremiumCollectionTimingLabel = insurancePremiumCollectionTimingLabel;

    readonly payrollClosingHelpLines = [
        '毎月の給与計算の締め日です。未設定でも利用できます。',
    ];

    readonly payrollPaymentHelpLines = [
        '報酬確定の社内期限として使用します。',
        'ホームの「期限が近い業務」にも反映されます。',
    ];

    readonly insuranceCollectionHelpLines = [
        '社会保険料を何月の給与から控除するかを指定します。',
        '翌月徴収の場合、4月分の保険料は5月の給与から控除され、4月の保険料画面では0円です。',
        '保険料計算画面の控除月表示に使用します。',
    ];

    // 事業所一覧
    offices = signal<Office[]>([]);

    // 初期処理
    async ngOnInit() {
        await this.loadCompany();
        await this.loadOffices();
    }

    // 会社情報のロード
    async loadCompany(): Promise<void> {
        this.isLoading.set(true);
        this.errorMessage.set('');

        try {
            // Authユーザーの取得
            const authUser = this.authService.getCurrentAuthUser();
            if(!authUser) {
                await this.router.navigate(['/login']);
                return;
            }

            // Appユーザーの取得
            const appUser = await this.userService.getUserByUid(authUser.uid);
            if(!appUser) {
                this.errorMessage.set('ユーザー情報が見つかりませんでした。')
                return;
            }

            // 会社情報の取得
            const company = await this.companyService.getCompanyById(appUser.companyId);
            if(!company) {
                this.errorMessage.set('会社情報が見つかりませんでした。');
                return;
            }

            this.company.set(company);
            this.syncFormFromCompany(company);
        } catch (error) {
            console.error('会社情報の取得に失敗しました。', error);
        } finally {
            this.isLoading.set(false);
        }
    }

    startCompanyEdit(): void {
        const company = this.company();
        if (!company) return;

        this.syncFormFromCompany(company);
        this.errorMessage.set('');
        this.isEditingCompany.set(true);
    }

    cancelCompanyEdit(): void {
        const company = this.company();
        if (company) {
            this.syncFormFromCompany(company);
        }
        this.errorMessage.set('');
        this.isEditingCompany.set(false);
    }

    async saveCompany(): Promise<void> {
        const company = this.company();
        if (!company) return;

        const name = this.companyName.trim();
        const representativeName = this.representativeName.trim();
        const address = this.companyAddress.trim();
        const payrollClosingDay = this.payrollClosingDay === '' ? null : this.payrollClosingDay;
        const payrollPaymentDay = this.payrollPaymentDay === '' ? null : this.payrollPaymentDay;

        if (!name || !representativeName || !address) {
            this.errorMessage.set('会社名・代表者・所在地を入力してください');
            return;
        }

        if (!isValidPayrollDay(payrollClosingDay) || !isValidPayrollDay(payrollPaymentDay)) {
            this.errorMessage.set('給与締日・支払日は1〜31の範囲で入力してください');
            return;
        }

        this.isSavingCompany.set(true);
        this.errorMessage.set('');

        try {
            await this.companyService.updateCompany(company.id, {
                name,
                representativeName,
                address,
                payrollClosingDay,
                payrollPaymentDay,
                payrollPaymentMonthOffset: this.payrollPaymentMonthOffset,
                insurancePremiumCollectionTiming: this.insurancePremiumCollectionTiming,
            });
            this.company.set({
                ...company,
                name,
                representativeName,
                address,
                payrollClosingDay,
                payrollPaymentDay,
                payrollPaymentMonthOffset: this.payrollPaymentMonthOffset,
                insurancePremiumCollectionTiming: this.insurancePremiumCollectionTiming,
            });
            this.isEditingCompany.set(false);
        } catch (error) {
            console.error('会社情報の更新に失敗しました', error);
            this.errorMessage.set('会社情報の更新に失敗しました');
        } finally {
            this.isSavingCompany.set(false);
        }
    }

    private syncFormFromCompany(company: Company): void {
        this.companyName = company.name;
        this.representativeName = company.representativeName;
        this.companyAddress = company.address;
        this.payrollClosingDay = company.payrollClosingDay ?? '';
        this.payrollPaymentDay = company.payrollPaymentDay ?? '';
        this.payrollPaymentMonthOffset = company.payrollPaymentMonthOffset;
        this.insurancePremiumCollectionTiming = company.insurancePremiumCollectionTiming;
    }

    formatOfficeAddress(office: Office): string {
        return formatOfficeAddress(office);
    }

    healthInsuranceLabel(type: Office['healthInsuranceType']): string {
        return healthInsuranceTypeLabel(type);
    }

    //// 事業所
    // 登録モーダル
    isOfficeModalOpen = signal<boolean>(false);
    isOfficeSaving = signal<boolean>(false);

    // モーダルの開閉
    openOfficeModal() {
        this.isOfficeModalOpen.set(true);
    }
    closeOfficeModal() {
        this.isOfficeModalOpen.set(false);
    }

    // 事業所の登録
    async onCreateOffice(form: OfficeFormData) {
        // 会社情報の有無
        const company = this.company();
        if (!company) {
            this.errorMessage.set('会社情報が読み込まれていません');
            return;
        }

        // ローディング
        this.isOfficeSaving.set(true);
        this.errorMessage.set('');

        try {
            const address = form.address.trim();
            const prefecture = extractPrefectureFromAddress(address) ?? '';

            // 事業所の作成
            const office: OfficeCreateInput = {
                companyId: company.id,
                name: form.name,
                postalCode: '',
                prefecture,
                city: '',
                streetAddress: address,
                buildingName: '',
                phoneNumber: '',
                healthInsuranceType: 'kyokai',
                regularWeeklyScheduledWorkHours: null,
                regularMonthlyScheduledWorkHours: null,
                regularWeeklyScheduledWorkDays: null,
                regularMonthlyScheduledWorkDays: null,
                status: 'active',
            };

            await this.officeService.createOffice(office);
            // 事業所のロード
            await this.loadOffices();
            // モーダルを閉じる
            this.closeOfficeModal();
        } catch (error) {
            console.error('事業所の登録に失敗しました。', error);
            this.errorMessage.set('事業所の登録に失敗しました');
        } finally {
            this.isOfficeSaving.set(false);
        }
    }

    // 事業所のローディング
    isLoadingOffices = signal<boolean>(false);
    errorMessageOffices = signal<string>('');

    // 事業所のロード
    async loadOffices(): Promise<void> {
        const company = this.company();
        if(!company) return;
        
        this.isLoadingOffices.set(true);
        this.errorMessageOffices.set('');
        this.offices.set([]);

        try {
            // 事業所の取得
            const offices = await this.officeService.getOfficesByCompanyId(company.id);
            this.offices.set(offices);
        } catch (error) {
            this.offices.set([]);
            console.error('事業所の取得に失敗しました', error);
            this.errorMessageOffices.set('事業所の取得に失敗しました');
        } finally {
            this.isLoadingOffices.set(false);
        }
    }
}
