import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SignupInput, AppUserInput } from '../models/auth.model';
import { AuthService } from '../services/auth.service';
import { UserService } from '../../users/services/user.service';

import { getAuth } from 'firebase/auth';

@Component({
    selector: 'app-signup-page',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './signup-page.component.html',
})

export class SignupPageComponent {
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);

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
                return;
            }
        this.currentStep = 2;
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

    // ログインページに遷移
    goToLoginPage() {
        this.router.navigate(['/login']);
    }

    // フォームが空白かどうか
    isFormEmpty(value: string): boolean {
        return value.trim() === '';
    }

    // サインイン
    async onSignup() {
        try {
            if(this.isFormEmpty(this.companyName) 
                || this.isFormEmpty(this.representativeName)
                || this.isFormEmpty(this.companyAddress)) {
                return;
            }

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
            const companyId = '';

            // Firestoreにユーザーを作成
            const appUserInput: AppUserInput = {
                uid: user.uid,
                ...input,
                role: 'admin',
                status: 'active',
                companyId: companyId,
                employeeId: null,
            }
            await this.userService.createUser(appUserInput);
        } catch (error) {
            console.error('サインインに失敗しました。', error);
        }
    }
}