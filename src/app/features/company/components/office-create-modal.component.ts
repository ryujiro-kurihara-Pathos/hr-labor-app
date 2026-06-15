import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FieldHelpTooltipComponent } from '../../../shared/components/field-help-tooltip.component';

export type OfficeFormData = {
    name: string;
    address: string;
};

@Component({
    selector: 'app-office-create-modal',
    standalone: true,
    imports: [FormsModule, FieldHelpTooltipComponent],
    templateUrl: './office-create-modal.component.html',
})

export class OfficeCreateModalComponent {
    // アウトプット
    close = output<void>();
    submit = output<OfficeFormData>();
    
    // ローディング
    isLoading = input(false);

    // 親コンポーネントからのイベント
    // close = output<void>();
    // submit = output<OfficeFormData>();

    // フォームデータ
    name = '';
    address = '';

    readonly healthInsuranceHelpLines = [
        '本アプリは協会けんぽのみに対応しています。',
        '事業所の都道府県に応じた協会けんぽ料率で保険料を計算します。',
    ];

    // エラーメッセージ
    errorMessage = signal('');

    // モーダルの背景クリック
    onBackdropClick(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
            this.close.emit();
        }
    }

    // キャンセル
    onCancel() {
        this.close.emit();
    }

    // 登録
    onSubmit() {
        if (!this.name.trim() || !this.address.trim()) {
            this.errorMessage.set('事業所名と所在地を入力してください');
            return;
        }

        this.errorMessage.set('');
        this.submit.emit({
            name: this.name.trim(),
            address: this.address.trim(),
        });
    }
}
