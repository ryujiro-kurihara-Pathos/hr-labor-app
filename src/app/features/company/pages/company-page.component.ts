import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';

import { Company } from '../models/company.model';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { CompanyService } from '../services/company.service';

import { OfficeModalComponent, OfficeFormData } from '../components/office-modal.component';
import { OfficeService } from '../services/Office.service';

@Component({
    selector: 'app-company-page',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, OfficeModalComponent],
    templateUrl: './company-page.component.html',
})

export class CompanyPageComponent {
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly companyService = inject(CompanyService);
    private readonly officeService = inject(OfficeService);
    private readonly router = inject(Router);

    // 会社情報
    company = signal<Company | null>(null);

    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    // 初期処理
    async ngOnInit() {
        await this.loadCompany();
    }

    // 会社情報の取得
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
        } catch (error) {
            console.error('会社情報の取得に失敗しました。', error);
        } finally {
            this.isLoading.set(false);
        }
    }

    // 事業所の登録
    // モーダル
    isOfficeModalOpen = signal<boolean>(false);
    isOfficeSaving = signal<boolean>(false);

    // モーダルの開閉
    openOfficeModal() {
        this.isOfficeModalOpen.set(true);
    }
    closeOfficeModal() {
        this.isOfficeModalOpen.set(false);
    }

    // 事業所を登録
    async onCreateOffice(form: OfficeFormData) {
        const company = this.company();
        if (!company) {
            this.errorMessage.set('会社情報が読み込まれていません');
            return;
        }

        this.isOfficeSaving.set(true);
        this.errorMessage.set('');

        try {
            await this.officeService.createOffice({
                companyId: company.id,
                name: form.name,
                address: form.address,
                healthInsuranceType: form.healthInsuranceType,
            });
            this.closeOfficeModal();
        } catch (error) {
            console.error('事業所の登録に失敗しました。', error);
            this.errorMessage.set('事業所の登録に失敗しました');
        } finally {
            this.isOfficeSaving.set(false);
        }
    }
}
