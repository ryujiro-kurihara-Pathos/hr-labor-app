import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { HomePageComponent } from './features/home/pages/home-page.component';
import { CompanyPageComponent } from './features/company/pages/company-page.component'

import { SignupPageComponent } from './features/auth/pages/signup-page.component';

export const routes: Routes = [
    {
        path: 'signup',
        component: SignupPageComponent,
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
            {
                path: '',
                redirectTo: 'home',
                pathMatch: 'full',
            }
        ]
    },
];
