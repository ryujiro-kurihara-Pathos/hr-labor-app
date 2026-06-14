import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';

import { guestGuard } from './guards/guest.guard';

import { adminGuard, employeeGuard } from './guards/role.guard';



import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';

import { SignupPageComponent } from './features/auth/pages/signup-page.component';

import { LoginPageComponent } from './features/auth/pages/login-page.component';
import { InviteAcceptPageComponent } from './features/auth/pages/invite-accept-page.component';

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

import { SocialInsuranceStatusPageComponent } from './features/social-insurance/pages/social-insurance-status-page.component';

import { ProfilePageComponent } from './features/users/pages/profile-page.component';

import { MyPageComponent } from './features/users/pages/my-page.component';

import { MyInsurancePremiumPageComponent } from './features/insurance/pages/my-insurance-premium-page.component';



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

            },

            {

                path: 'invite/:invitationId',

                component: InviteAcceptPageComponent,

            }

        ]

    },

    {

        path: '',

        component: MainLayoutComponent,

        canActivate: [authGuard],

        children: [

            // 管理者向け

            {

                path: 'home',

                component: HomePageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'company',

                component: CompanyPageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'company/offices/:officeId',

                component: OfficePageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'employees',

                component: EmployeePageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'employees/new',

                component: EmployeeCreatePageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'employees/:employeeId',

                component: EmployeeDetailPageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'social-insurance-status',

                component: SocialInsuranceStatusPageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'premium',

                component: InsurancePremiumPageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'premium/:employeeId',

                component: InsurancePremiumDetailPageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'procedures',

                component: SocialInsuranceProceduresPageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'procedures/:procedureId',

                component: SocialInsuranceProcedureDetailPageComponent,

                canActivate: [adminGuard],

            },

            {

                path: 'profile',

                component: ProfilePageComponent,

                canActivate: [adminGuard],

            },

            // 従業員向け

            {

                path: 'my-page',

                component: MyPageComponent,

                canActivate: [employeeGuard],

            },

            {

                path: 'my-insurance-premium',

                component: MyInsurancePremiumPageComponent,

                canActivate: [employeeGuard],

            },

        ]

    },

];

