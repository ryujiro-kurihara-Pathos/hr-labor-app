import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { HomePageComponent } from './features/home/pages/home-page.component';
import { CompanyPageComponent } from './features/company/pages/company-page.component'
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { SignupPageComponent } from './features/auth/pages/signup-page.component';
import { LoginPageComponent } from './features/auth/pages/login-page.component';

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
            {
                path: 'home',
                component: HomePageComponent,
            },
            {
                path: 'company',
                component: CompanyPageComponent,
            },
        ]
    },
];
