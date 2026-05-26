import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Office } from '../models/office.model';
import { OfficeService } from '../services/office.service';

@Component({
    selector: 'app-office-page',
    standalone: true,
    templateUrl: './office-page.component.html',
})

export class OfficePageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly officeService = inject(OfficeService);

    // 事業所
    office = signal<Office | null>(null);

    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    // 初期処理
    async ngOnInit() {
        const officeId = this.route.snapshot.params['officeId'];

        if(!officeId) {
            this.isLoading.set(false);
            this.errorMessage.set('事業所が見つかりませんでした');
            return;
        }

        await this.loadOffice(officeId);
    }

    // 事業所のロード
    async loadOffice(officeId: string): Promise<void> {
        this.isLoading.set(true);
        this.errorMessage.set('');
        this.office.set(null);

        try {
            // 事業所の取得
            const office = await this.officeService.getOfficeById(officeId);
            this.office.set(office);
        } catch (error) {
            console.error('事業所の取得に失敗しました', error);
            this.errorMessage.set('事業所の取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }
}