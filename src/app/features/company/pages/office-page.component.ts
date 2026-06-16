import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Office } from '../models/office.model';
import { OfficeDeletionError, OfficeService } from '../services/office.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { FieldHelpTooltipComponent } from '../../../shared/components/field-help-tooltip.component';
import {
    formatOfficeAddress,
    normalizeOfficeNumber,
    normalizeOfficeSymbol,
} from '../utils/office-format.util';
import { healthInsuranceTypeLabel } from '../utils/office-health-insurance.util';
import { OfficeDeletionCheck, officeDeletionBlockedMessage } from '../utils/office-usage.util';
import { PostalCodeLookupService } from '../../../shared/services/postal-code-lookup.service';
import { applyPostalLookupResult } from '../../../shared/utils/postal-code-lookup.util';

@Component({
    selector: 'app-office-page',
    standalone: true,
    imports: [FormsModule, RouterLink, FieldHelpTooltipComponent],
    templateUrl: './office-page.component.html',
})

export class OfficePageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly officeService = inject(OfficeService);
    private readonly router = inject(Router);
    private readonly confirmService = inject(ConfirmService);
    private readonly postalCodeLookupService = inject(PostalCodeLookupService);

    // 事業所
    office = signal<Office | null>(null);
    deletionCheck = signal<OfficeDeletionCheck | null>(null);

    isLoading = signal<boolean>(false);
    isSaving = signal<boolean>(false);
    isEditing = signal<boolean>(false);
    isPostalLookupLoading = signal(false);
    postalLookupError = signal('');
    errorMessage = signal<string>('');

    name = '';
    postalCode = '';
    prefecture = '';
    city = '';
    streetAddress = '';
    buildingName = '';
    phoneNumber = '';
    officeSymbol = '';
    officeNumber = '';
    regularWeeklyScheduledWorkHours: string | number = '';
    regularMonthlyScheduledWorkDays: string | number = '';

    readonly healthInsuranceHelpLines = [
        '本アプリは協会けんぽのみに対応しています。',
        '事業所の都道府県に応じた協会けんぽ料率で保険料を計算します。',
    ];

    readonly officeSymbolHelpLines = [
        '納入告知書の形式どおり「2桁-カタカナ1～4桁」で入力してください。',
        '未入力の場合は登録時に仮番号が自動で割り当てられます。',
    ];

    readonly officeNumberHelpLines = [
        '厚生年金の事業所番号（5桁）です。',
        '未入力の場合は登録時に仮番号が自動で割り当てられます。',
    ];

    readonly regularWorkerHelpLines = [
        'パート・アルバイトの加入要件判定（4分の3ルール）で、週の所定労働時間と月の所定労働日数を参照します。',
        '未入力の場合は絶対基準のみで判定します。',
    ];

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
                const check = await this.officeService.getOfficeDeletionCheck(office.id);
                this.deletionCheck.set(check);
            } else {
                this.deletionCheck.set(null);
            }
        } catch (error) {
            console.error('事業所の取得に失敗しました', error);
            this.errorMessage.set('事業所の取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    // 健康保険の種類のラベル
    healthInsuranceLabel(type: Office['healthInsuranceType']): string {
        return healthInsuranceTypeLabel(type);
    }

    displayValue(value: string): string {
        return value.trim() ? value : '—';
    }

    formatAddress(office: Office): string {
        return formatOfficeAddress(office);
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
        this.postalLookupError.set('');
        this.isEditing.set(true);
    }

    // 編集キャンセル
    cancelEdit(): void {
        const office = this.office();
        if (office) {
            this.syncFormFromOffice(office);
        }
        this.errorMessage.set('');
        this.postalLookupError.set('');
        this.isEditing.set(false);
    }

    async lookupAddressFromPostalCode(): Promise<void> {
        this.postalLookupError.set('');
        this.isPostalLookupLoading.set(true);

        try {
            const result = await this.postalCodeLookupService.lookup(this.postalCode);
            applyPostalLookupResult(this, result);
        } catch (error) {
            this.postalLookupError.set(this.postalCodeLookupService.toUserMessage(error));
        } finally {
            this.isPostalLookupLoading.set(false);
        }
    }

    // 保存
    async saveOffice(): Promise<void> {
        const office = this.office();
        if (!office) return;

        this.isSaving.set(true);
        this.errorMessage.set('');

        try {
            const regularWeeklyScheduledWorkHours = this.toNullableNumber(this.regularWeeklyScheduledWorkHours);
            const regularMonthlyScheduledWorkDays = this.toNullableNumber(this.regularMonthlyScheduledWorkDays);

            const officeSymbol = normalizeOfficeSymbol(this.officeSymbol);

            await this.officeService.updateOffice(office.id, {
                companyId: office.companyId,
                name: this.name,
                postalCode: this.postalCode,
                prefecture: this.prefecture,
                city: this.city,
                streetAddress: this.streetAddress,
                buildingName: this.buildingName,
                phoneNumber: this.phoneNumber,
                healthInsuranceType: 'kyokai',
                officeSymbol,
                officeNumber: normalizeOfficeNumber(this.officeNumber),
                regularWeeklyScheduledWorkHours,
                regularMonthlyScheduledWorkHours: null,
                regularWeeklyScheduledWorkDays: null,
                regularMonthlyScheduledWorkDays,
                status: office.status,
            });
            await this.refreshOffice(office.id);
            this.isEditing.set(false);
        } catch (error) {
            console.error('事業所の更新に失敗しました', error);
            this.errorMessage.set('事業所の更新に失敗しました');
        } finally {
            this.isSaving.set(false);
        }
    }

    deletionBlockedMessage(): string {
        const check = this.deletionCheck();
        return check ? officeDeletionBlockedMessage(check) : '';
    }

    managementHelpLines(): string[] {
        const check = this.deletionCheck();
        const isDisabled = this.office()?.status === 'disabled';
        const lines = [
            '事業所は従業員・社会保険・保険料計算・届出手続きに紐づくため、原則として物理削除は行いません。',
            '使用しなくなった場合は無効化してください。無効化された事業所は新規登録や新規手続きでは選択できませんが、過去データの参照には残ります。',
        ];

        if (isDisabled) {
            lines.push('この事業所は無効化済みです。再度使う場合はページ上部の「有効化」から戻せます。');
        }

        if (check?.canDelete) {
            lines.push('この事業所はまだ業務データに紐づいていないため、削除できます。');
        } else if (check) {
            lines.push(this.deletionBlockedMessage());
        }

        return lines;
    }

    // 事業所の削除
    async deleteOffice(): Promise<void> {
        const office = this.office();
        const check = this.deletionCheck();
        if (!office || !check) return;

        if (!check.canDelete) {
            this.errorMessage.set(this.deletionBlockedMessage());
            return;
        }

        const confirmed = await this.confirmService.confirm(
            'この事業所はまだ業務データに紐づいていません。削除すると元に戻せません。本当に削除しますか？',
            {
                confirmLabel: '削除する',
                cancelLabel: 'キャンセル',
                danger: true,
            },
        );
        if (!confirmed) return;

        this.isLoading.set(true);
        this.errorMessage.set('');

        try {
            await this.officeService.deleteOffice(office.id);
            this.router.navigate(['/company']);
        } catch (error) {
            console.error('事業所の削除に失敗しました', error);
            if (error instanceof OfficeDeletionError) {
                this.errorMessage.set(error.message);
            } else {
                this.errorMessage.set('事業所の削除に失敗しました');
            }
        } finally {
            this.isLoading.set(false);
        }
    }

    // 事業所の無効化
    async disableOffice(): Promise<void> {
        const office = this.office();
        if (!office) return;

        const confirmed = await this.confirmService.confirm(
            'この事業所を無効化しますか？無効化すると新規の従業員登録や新規手続きでは選択できなくなります。過去データの参照は引き続き可能です。',
            {
                confirmLabel: '無効化する',
                cancelLabel: 'キャンセル',
                danger: true,
            },
        );
        if (!confirmed) return;

        this.isLoading.set(true);
        this.errorMessage.set('');

        try {
            await this.officeService.disableOffice(office.id);
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
        if (!office) return;

        const confirmed = await this.confirmService.confirm(
            'この事業所を有効化しますか？新規の従業員登録や新規手続きで再び選択できるようになります。',
            {
                confirmLabel: '有効化する',
                cancelLabel: 'キャンセル',
            },
        );
        if (!confirmed) return;

        this.isLoading.set(true);
        this.errorMessage.set('');

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

    private async refreshOffice(officeId: string): Promise<void> {
        const refreshed = await this.officeService.getOfficeById(officeId);
        if (!refreshed) return;
        this.office.set(refreshed);
        this.syncFormFromOffice(refreshed);
    }

    private syncFormFromOffice(office: Office): void {
        this.name = office.name;
        this.postalCode = office.postalCode;
        this.prefecture = office.prefecture;
        this.city = office.city;
        this.streetAddress = office.streetAddress;
        this.buildingName = office.buildingName;
        this.phoneNumber = office.phoneNumber;
        this.officeSymbol = office.officeSymbol;
        this.officeNumber = office.officeNumber;
        this.regularWeeklyScheduledWorkHours = this.numberToFormValue(office.regularWeeklyScheduledWorkHours);
        this.regularMonthlyScheduledWorkDays = this.numberToFormValue(office.regularMonthlyScheduledWorkDays);
    }

    private numberToFormValue(value: number | null | undefined): string {
        return value !== null && value !== undefined ? String(value) : '';
    }

    private toNullableNumber(value: string | number | null | undefined): number | null {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        const num = Number(trimmed);
        return Number.isFinite(num) ? num : null;
    }
}