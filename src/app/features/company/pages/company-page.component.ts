import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import { Company } from '../models/company.model';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { CompanyService } from '../services/company.service';
import { insurancePremiumCollectionTimingLabel } from '../utils/company-payroll-settings.util';
import {
    APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
    INSURANCE_PREMIUM_COLLECTION_TIMING_APP_NOTE,
} from '../models/company.model';

import { OfficeCreateModalComponent, OfficeFormData } from '../components/office-create-modal.component';
import { OfficeNameDuplicateError, OfficeService } from '../services/office.service';
import { Office, OfficeCreateInput } from '../models/office.model';
import { formatOfficeAddress } from '../utils/office-format.util';
import { healthInsuranceTypeLabel } from '../utils/office-health-insurance.util';
import { isDuplicateOfficeName } from '../utils/office-name.util';
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
    payrollPaymentMonthOffset: 0 | 1 = 1;

    readonly insurancePremiumCollectionTimingLabel = insurancePremiumCollectionTimingLabel;
    readonly insurancePremiumCollectionTimingAppNote = INSURANCE_PREMIUM_COLLECTION_TIMING_APP_NOTE;

    readonly payrollPaymentMonthHelpLines = [
        '給与を支払う月です。当月または翌月から選択します。',
    ];

    readonly insurancePremiumCollectionHelpLines = [
        '前月分の保険料を、当月の給与から控除します（翌月徴収）。',
        '例）5月の給与から控除するのは4月分の保険料です。',
        INSURANCE_PREMIUM_COLLECTION_TIMING_APP_NOTE,
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

        if (!name || !representativeName || !address) {
            this.errorMessage.set('会社名・代表者・所在地を入力してください');
            return;
        }

        this.isSavingCompany.set(true);
        this.errorMessage.set('');

        try {
            await this.companyService.updateCompany(company.id, {
                name,
                representativeName,
                address,
                payrollPaymentMonthOffset: this.payrollPaymentMonthOffset,
                insurancePremiumCollectionTiming: APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
            });
            this.company.set({
                ...company,
                name,
                representativeName,
                address,
                payrollPaymentMonthOffset: this.payrollPaymentMonthOffset,
                insurancePremiumCollectionTiming: APP_INSURANCE_PREMIUM_COLLECTION_TIMING,
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
        this.payrollPaymentMonthOffset = company.payrollPaymentMonthOffset;
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
    officeCreateErrorMessage = signal<string>('');

    openOfficeModal() {
        this.officeCreateErrorMessage.set('');
        this.isOfficeModalOpen.set(true);
    }
    closeOfficeModal() {
        this.officeCreateErrorMessage.set('');
        this.isOfficeModalOpen.set(false);
    }

    async onCreateOffice(form: OfficeFormData) {
        const company = this.company();
        if (!company) {
            this.officeCreateErrorMessage.set('会社情報が読み込まれていません');
            return;
        }

        if (isDuplicateOfficeName(this.offices(), form.name)) {
            this.officeCreateErrorMessage.set('同じ事業所名が既に登録されています');
            return;
        }

        this.isOfficeSaving.set(true);
        this.officeCreateErrorMessage.set('');

        try {
            const office: OfficeCreateInput = {
                companyId: company.id,
                name: form.name,
                postalCode: '',
                prefecture: form.prefecture,
                city: form.city,
                streetAddress: form.streetAddress,
                buildingName: form.buildingName,
                phoneNumber: '',
                healthInsuranceType: form.healthInsuranceType,
                regularWeeklyScheduledWorkHours: null,
                regularMonthlyScheduledWorkHours: null,
                regularWeeklyScheduledWorkDays: null,
                regularMonthlyScheduledWorkDays: null,
                status: 'active',
            };

            await this.officeService.createOffice(office);
            await this.loadOffices();
            this.closeOfficeModal();
        } catch (error) {
            console.error('事業所の登録に失敗しました。', error);
            if (error instanceof OfficeNameDuplicateError) {
                this.officeCreateErrorMessage.set(error.message);
            } else {
                this.officeCreateErrorMessage.set('事業所の登録に失敗しました');
            }
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
