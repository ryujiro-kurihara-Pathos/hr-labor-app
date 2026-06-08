import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-social-insurance-procedure-detail-page',
    standalone: true,
    imports: [],
    templateUrl: './social-insurance-procedure-detail-page.component.html',
})

export class SocialInsuranceProcedureDetailPageComponent {
    private readonly route = inject(ActivatedRoute);
    // 手続きID
    procedureName = signal<string>('');

    // ローディング
    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    ngOnInit() {
        this.isLoading.set(true);
        this.errorMessage.set('');

        this.procedureName.set(this.route.snapshot.params['procedureName'] ?? '');

        this.isLoading.set(false);
    }
}