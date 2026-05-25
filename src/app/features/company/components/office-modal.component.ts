import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { HealthInsuranceType } from '../models/Office.model';

export type OfficeFormData = {
    name: string;
    address: string;
    healthInsuranceType: HealthInsuranceType;
};

@Component({
    selector: 'app-office-modal',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './office-modal.component.html',
})

export class OfficeModalComponent {
    // ローディング
    isLoading = input(false);

    close = output<void>();
    submit = output<OfficeFormData>();

    name = '';
    address = '';
    healthInsuranceType: HealthInsuranceType = 'kyokai';

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
        if (!this.name.trim() || !this.address.trim()) {
            this.errorMessage.set('事業所名と所在地を入力してください');
            return;
        }

        this.errorMessage.set('');
        this.submit.emit({
            name: this.name.trim(),
            address: this.address.trim(),
            healthInsuranceType: this.healthInsuranceType,
        });
    }
}
