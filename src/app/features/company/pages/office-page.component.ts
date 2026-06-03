import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { HealthInsuranceType, Office } from '../models/office.model';
import { OfficeService } from '../services/office.service';

@Component({
    selector: 'app-office-page',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './office-page.component.html',
})

export class OfficePageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly officeService = inject(OfficeService);
    private readonly router = inject(Router);   

    // 事業所
    office = signal<Office | null>(null);

    isLoading = signal<boolean>(false);
    isSaving = signal<boolean>(false);
    isEditing = signal<boolean>(false);
    errorMessage = signal<string>('');

    name = '';
    address = '';
    healthInsuranceType: HealthInsuranceType = 'kyokai';
    regularWeeklyScheduledWorkHours = '';
    regularMonthlyScheduledWorkHours = '';
    regularWeeklyScheduledWorkDays = '';
    regularMonthlyScheduledWorkDays = '';

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
            if (office) {
                this.syncFormFromOffice(office);
            }
        } catch (error) {
            console.error('事業所の取得に失敗しました', error);
            this.errorMessage.set('事業所の取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    // 健康保険の種類のラベル
    healthInsuranceLabel(type: HealthInsuranceType): string {
        return type === 'kyokai' ? '協会けんぽ' : '組合健保';
    }

    displayValue(value: string): string {
        return value.trim() ? value : '—';
    }

    displayNumber(value: number | null | undefined): string {
        return value !== null && value !== undefined ? String(value) : '—';
    }

    // 編集開始
    startEdit(): void {
        const office = this.office();
        if (!office) return;

        this.syncFormFromOffice(office);
        this.errorMessage.set('');
        this.isEditing.set(true);
    }

    // 編集キャンセル
    cancelEdit(): void {
        const office = this.office();
        if (office) {
            this.syncFormFromOffice(office);
        }
        this.errorMessage.set('');
        this.isEditing.set(false);
    }

    // 保存
    async saveOffice(): Promise<void> {
        const office = this.office();
        if (!office) return;

        this.isSaving.set(true);
        this.errorMessage.set('');

        try {
            const regularWeeklyScheduledWorkHours = this.toNullableNumber(this.regularWeeklyScheduledWorkHours);
            const regularMonthlyScheduledWorkHours = this.toNullableNumber(this.regularMonthlyScheduledWorkHours);
            const regularWeeklyScheduledWorkDays = this.toNullableNumber(this.regularWeeklyScheduledWorkDays);
            const regularMonthlyScheduledWorkDays = this.toNullableNumber(this.regularMonthlyScheduledWorkDays);

            await this.officeService.updateOffice(office.id, {
                companyId: office.companyId,
                name: this.name,
                prefecture: office.prefecture,
                address: this.address,
                healthInsuranceType: this.healthInsuranceType,
                regularWeeklyScheduledWorkHours,
                regularMonthlyScheduledWorkHours,
                regularWeeklyScheduledWorkDays,
                regularMonthlyScheduledWorkDays,
                status: office.status,
            });
            this.office.set({
                ...office,
                name: this.name,
                address: this.address,
                healthInsuranceType: this.healthInsuranceType,
                regularWeeklyScheduledWorkHours,
                regularMonthlyScheduledWorkHours,
                regularWeeklyScheduledWorkDays,
                regularMonthlyScheduledWorkDays,
            });
            this.isEditing.set(false);
        } catch (error) {
            console.error('事業所の更新に失敗しました', error);
            this.errorMessage.set('事業所の更新に失敗しました');
        } finally {
            this.isSaving.set(false);
        }
    }

    // 事業所の削除
    async deleteOffice(): Promise<void> {
        // 事業所IDの取得
        const officeId = this.office()?.id;
        if(!officeId) return;

        // ローディング
        this.isLoading.set(true);

        try {
            await this.officeService.deleteOffice(officeId);
            this.router.navigate(['/company']);
        } catch (error) {
            console.error('事業所の削除に失敗しました', error);
            this.errorMessage.set('事業所の削除に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    // 事業所の無効化
    async disableOffice(): Promise<void> {
        const office = this.office();
        if(!office) return;

        try {
            // Firestoreの更新
            await this.officeService.disableOffice(office.id);
            // ページの更新
            this.office.set({
                ...office,
                status: 'disabled',
            });
        } catch (error) {
            console.error('事業所の無効化に失敗しました', error);
            this.errorMessage.set('事業所の無効化に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    // 事業所の有効化
    async enableOffice(): Promise<void> {
        const office = this.office();
        if(!office) return;

        try {
            await this.officeService.enableOffice(office.id);
            this.office.set({
                ...office,
                status: 'active',
            });
        } catch (error) {   
            console.error('事業所の有効化に失敗しました', error);
            this.errorMessage.set('事業所の有効化に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    private syncFormFromOffice(office: Office): void {
        this.name = office.name;
        this.address = office.address;
        this.healthInsuranceType = office.healthInsuranceType;
        this.regularWeeklyScheduledWorkHours = this.numberToFormValue(office.regularWeeklyScheduledWorkHours);
        this.regularMonthlyScheduledWorkHours = this.numberToFormValue(office.regularMonthlyScheduledWorkHours);
        this.regularWeeklyScheduledWorkDays = this.numberToFormValue(office.regularWeeklyScheduledWorkDays);
        this.regularMonthlyScheduledWorkDays = this.numberToFormValue(office.regularMonthlyScheduledWorkDays);
    }

    private numberToFormValue(value: number | null | undefined): string {
        return value !== null && value !== undefined ? String(value) : '';
    }

    private toNullableNumber(value: string): number | null {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const num = Number(trimmed);
        return Number.isFinite(num) ? num : null;
    }
}