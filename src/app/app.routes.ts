import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { SignupPageComponent } from './features/auth/pages/signup-page.component';
import { LoginPageComponent } from './features/auth/pages/login-page.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { HomePageComponent } from './features/home/pages/home-page.component';
import { CompanyPageComponent } from './features/company/pages/company-page.component';
import { EmployeePageComponent } from './features/employee/pages/employee-page.component';
import { OfficePageComponent } from './features/company/pages/office-page.component';
import { EmployeeCreatePageComponent } from './features/employee/pages/employee-create-page.component';
import { EmployeeDetailPageComponent } from './features/employee/pages/employee-detail-page.component';
import { InsurancePremiumPageComponent } from './features/insurance/pages/insurance-premium-page.component';
import { InsurancePremiumDetailPageComponent } from './features/insurance/pages/insurance-premium-detail-page.component';
import { SocialInsuranceProceduresPageComponent } from './features/social-insurance/pages/social-insurance-procedures-page.component';
import { SocialInsuranceProcedureDetailPageComponent } from './features/social-insurance/pages/social-insurance-procedure-detail-page.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
    },
    {
        path: '',
        component: AuthLayoutComponent,
        canActivate: [guestGuard],
        children: [
            {
                path: 'signup',
                component: SignupPageComponent,
            },
            {
                path: 'login',
                component: LoginPageComponent,
            }
        ]
    },
    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        children: [
            // ホーム
            {
                path: 'home',
                component: HomePageComponent,
            },
            // 会社・事業所情報
            {
                path: 'company',
                component: CompanyPageComponent,
            },
            {
                path: 'company/offices/:officeId',
                component: OfficePageComponent,
            },
            // 従業員管理
            {
                path: 'employees',
                component: EmployeePageComponent,
            },
            {
                path: 'employees/new',
                component: EmployeeCreatePageComponent,
            },
            {
                path: 'employees/:employeeId',
                component: EmployeeDetailPageComponent,
            },
            // 保険料計算
            {
                path: 'premium',
                component: InsurancePremiumPageComponent,
            },
            {
                path: 'premium/:employeeId',
                component: InsurancePremiumDetailPageComponent,
            },
            // 手続き一覧
            {
                path: 'procedures',
                component: SocialInsuranceProceduresPageComponent,
            },
            {
                path: 'procedures/:procedureName',
                component: SocialInsuranceProcedureDetailPageComponent,
            },
        ]
    },
];
