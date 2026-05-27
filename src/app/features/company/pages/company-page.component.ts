import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';

import { Company } from '../models/company.model';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { CompanyService } from '../services/company.service';

import { OfficeCreateModalComponent, OfficeFormData } from '../components/office-create-modal.component';
import { OfficeService } from '../services/office.service';
import { Office } from '../models/office.model';

@Component({
    selector: 'app-company-page',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, OfficeCreateModalComponent],
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
    errorMessage = signal<string>('');

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
        } catch (error) {
            console.error('会社情報の取得に失敗しました。', error);
        } finally {
            this.isLoading.set(false);
        }
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
            // 事業所の作成
            const office = {
                companyId: company.id,
                name: form.name,
                address: form.address,
                healthInsuranceType: form.healthInsuranceType,
                status: 'active',
            } as Office;
            
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
