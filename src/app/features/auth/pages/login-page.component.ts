import { Component,inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-login-page',
    standalone: true,
    imports: [],
    templateUrl: './login-page.component.html',
})

export class LoginPageComponent {
    private readonly router = inject(Router);

    // 新規登録ページに遷移
    goToSignupPage() {
        this.router.navigate(['/signup']);
    }
}