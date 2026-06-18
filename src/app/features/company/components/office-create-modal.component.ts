import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FieldHelpTooltipComponent } from '../../../shared/components/field-help-tooltip.component';
import { JAPANESE_PREFECTURES } from '../../../shared/constants/japanese-prefectures';
import { HealthInsuranceType } from '../models/office.model';

export type OfficeFormData = {
    name: string;
    prefecture: string;
    city: string;
    streetAddress: string;
    buildingName: string;
    healthInsuranceType: HealthInsuranceType;
};

@Component({
    selector: 'app-office-create-modal',
    standalone: true,
    imports: [FormsModule, FieldHelpTooltipComponent],
    templateUrl: './office-create-modal.component.html',
})
export class OfficeCreateModalComponent {
    close = output<void>();
    submit = output<OfficeFormData>();

    isLoading = input(false);
    serverErrorMessage = input('');

    name = '';
    prefecture = '';
    city = '';
    streetAddress = '';
    buildingName = '';

    readonly prefectures = JAPANESE_PREFECTURES;
    readonly healthInsuranceType: HealthInsuranceType = 'kyokai';

    readonly healthInsuranceHelpLines = [
        '本アプリは協会けんぽのみに対応しています。',
        '事業所の都道府県に応じた協会けんぽ料率で保険料を計算します。',
    ];

    errorMessage = signal('');

    onBackdropClick(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
            this.close.emit();
        }
    }

    onCancel() {
        this.close.emit();
    }

    onSubmit() {
        const name = this.name.trim();
        const prefecture = this.prefecture.trim();
        const city = this.city.trim();
        const streetAddress = this.streetAddress.trim();
        const buildingName = this.buildingName.trim();

        if (!name) {
            this.errorMessage.set('事業所名を入力してください');
            return;
        }
        if (!prefecture) {
            this.errorMessage.set('都道府県を選択してください');
            return;
        }

        this.errorMessage.set('');
        this.submit.emit({
            name,
            prefecture,
            city,
            streetAddress,
            buildingName,
            healthInsuranceType: this.healthInsuranceType,
        });
    }

    displayErrorMessage(): string {
        return this.errorMessage() || this.serverErrorMessage();
    }
}
