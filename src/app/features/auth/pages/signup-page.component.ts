import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../services/auth.service';
import { UserService } from '../../users/services/user.service';
import { CompanyService } from '../../company/services/company.service';

<<<<<<< HEAD
import { SignupInput, AppUserInput } from '../models/auth.model';
import { CompanyInput } from '../../company/models/company.model';

=======
>>>>>>> b66b9da22dae6075d8d69a015b6aa16cb8fc4d5b
@Component({
    selector: 'app-signup-page',
    standalone: true,
    imports: [FormsModule, RouterLink],
    templateUrl: './signup-page.component.html',
})

export class SignupPageComponent {
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly companyService = inject(CompanyService);
    private readonly router = inject(Router);

    // 現在のステップ
    // 1: ユーザー情報, 2: 会社情報
    currentStep: 1 | 2 = 1;

    // フォームページ遷移
    goToCompanyForm() {
        if(this.isFormEmpty(this.lastName) 
            || this.isFormEmpty(this.firstName)
            || this.isFormEmpty(this.email) 
            || this.isFormEmpty(this.password) 
            || this.isFormEmpty(this.confirmPassword)) {
                this.errorMessage = 'ユーザー情報を入力してください';
                return;
            }
        this.currentStep = 2;
        this.errorMessage = '';
    }
    backToUserForm() {
        this.currentStep = 1;
    }

    // ユーザー情報
    lastName = '';
    firstName = '';
    email = '';

    password = '';
    confirmPassword = '';

    // 会社情報
    companyName = '';
    representativeName = '';
    companyAddress = '';

    errorMessage = '';
    isLoading = false;

    // サインイン
    async onSignup() {
        this.errorMessage = '';

        if(this.isFormEmpty(this.companyName) || this.isFormEmpty(this.representativeName) || this.isFormEmpty(this.companyAddress)) {
            this.errorMessage = '会社情報を入力してください';
            return;
        }

        try {
            // Authenticationにユーザーを作成
            const input: SignupInput = {
                lastName: this.lastName,
                firstName: this.firstName,
                email: this.email,
                password: this.password,
                confirmPassword: this.confirmPassword,
                
                companyName: this.companyName,
                representativeName: this.representativeName,
                companyAddress: this.companyAddress,
            }
            const user = await this.authService.createInitialAdminUser(input);

            // Firestoreに会社を作成
            const companyInput: CompanyInput = {
                name: this.companyName,
                representativeName: this.representativeName,
                address: this.companyAddress,
                createdBy: user.uid,
            }
            const company = await this.companyService.createCompany(companyInput);
            const companyId = company.id;

            // Firestoreにユーザーを作成
            const appUserInput: AppUserInput = {
                uid: user.uid,
                lastName: input.lastName,
                firstName: input.firstName,
                email: input.email,
                
                role: 'admin',
                status: 'active',

                companyId: companyId,
                employeeId: null,
            };
            await this.userService.createUser(appUserInput);

<<<<<<< HEAD
            // ログイン画面に遷移
            await this.router.navigate(['/login']);
=======
            this.router.navigate(['/home']);
>>>>>>> b66b9da22dae6075d8d69a015b6aa16cb8fc4d5b
        } catch (error) {
            console.error('サインインに失敗しました。', error);
        }
    }

    // フォームが空白かどうか
    isFormEmpty(value: string): boolean {
        return value.trim() === '';
    }
}