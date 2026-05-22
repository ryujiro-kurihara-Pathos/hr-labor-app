import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';

import { Company } from '../models/company.model';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { CompanyService } from '../services/company.service';

@Component({
    selector: 'app-company-page',
    standalone: true,
    imports: [RouterLink, RouterLinkActive],
    templateUrl: './company-page.component.html',
})

export class CompanyPageComponent {
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly companyService = inject(CompanyService);
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
}
