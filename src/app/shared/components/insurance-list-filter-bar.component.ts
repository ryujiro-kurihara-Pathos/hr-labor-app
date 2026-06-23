import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export type InsuranceListStatusFilterOption = {
    value: string;
    label: string;
    warn?: boolean;
};

@Component({
    selector: 'app-insurance-list-filter-bar',
    standalone: true,
    imports: [FormsModule],
    template: `
        <div class="list-filter-bar">
            <div class="list-filter-main">
                <label class="sr-only" [attr.for]="searchInputId()">検索</label>
                <input
                    [id]="searchInputId()"
                    type="search"
                    class="filter-search-input"
                    [ngModel]="keyword()"
                    (ngModelChange)="keywordChange.emit($event)"
                    placeholder="氏名・社員番号で検索"
                />
                <div class="filter-office-field">
                    <label class="sr-only" [attr.for]="officeSelectId()">事業所</label>
                    <select
                        [id]="officeSelectId()"
                        class="filter-office-select"
                        [ngModel]="officeId()"
                        (ngModelChange)="officeIdChange.emit($event)"
                    >
                        <option value="">すべての事業所</option>
                        @for (office of officeOptions(); track office.id) {
                            <option [value]="office.id">{{ office.name }}</option>
                        }
                    </select>
                </div>
                @if (hasActiveFilters()) {
                    <button type="button" class="filter-clear-btn" (click)="clear.emit()">クリア</button>
                }
            </div>
            @if (statusOptions().length > 0) {
                <div class="status-filter-chips" role="group" [attr.aria-label]="statusGroupLabel()">
                    @for (option of statusOptions(); track option.value) {
                        <button
                            type="button"
                            class="status-chip"
                            [class.active]="statusFilter() === option.value"
                            [class.warn]="option.warn"
                            (click)="statusFilterChange.emit(option.value)"
                        >
                            {{ option.label }}
                        </button>
                    }
                </div>
            }
        </div>
    `,
    styles: `
        .list-filter-bar {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
            padding: 14px 16px;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
        }

        .list-filter-main {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
        }

        .filter-search-input {
            flex: 1 1 220px;
            min-width: 0;
            height: 40px;
            padding: 0 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            background: #fff;
        }

        .filter-search-input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .filter-office-field {
            flex: 0 1 200px;
            min-width: 160px;
        }

        .filter-office-select {
            width: 100%;
            height: 40px;
            padding: 0 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            background: #fff;
            color: #374151;
        }

        .filter-office-select:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .filter-clear-btn {
            height: 40px;
            padding: 0 12px;
            border: none;
            border-radius: 8px;
            background: transparent;
            color: #2563eb;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }

        .filter-clear-btn:hover {
            background: #eff6ff;
        }

        .status-filter-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .status-chip {
            height: 32px;
            padding: 0 12px;
            border: 1px solid #e5e7eb;
            border-radius: 999px;
            background: #f9fafb;
            color: #4b5563;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }

        .status-chip:hover {
            border-color: #bfdbfe;
            color: #1d4ed8;
            background: #eff6ff;
        }

        .status-chip.active {
            border-color: #2563eb;
            background: #eff6ff;
            color: #1d4ed8;
        }

        .status-chip.warn.active {
            border-color: #fb923c;
            background: #fff7ed;
            color: #c2410c;
        }

        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }
    `,
})
export class InsuranceListFilterBarComponent {
    keyword = input('');
    officeId = input('');
    statusFilter = input('all');
    officeOptions = input<{ id: string; name: string }[]>([]);
    statusOptions = input<InsuranceListStatusFilterOption[]>([]);
    searchInputId = input('insurance-list-search');
    officeSelectId = input('insurance-list-office');
    statusGroupLabel = input('表示条件');

    keywordChange = output<string>();
    officeIdChange = output<string>();
    statusFilterChange = output<string>();
    clear = output<void>();

    hasActiveFilters = computed(
        () => Boolean(this.keyword().trim() || this.officeId() || this.statusFilter() !== 'all'),
    );
}
