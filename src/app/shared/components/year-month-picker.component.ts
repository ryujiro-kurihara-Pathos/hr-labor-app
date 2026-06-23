import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
    clampYearMonth,
    formatYearMonth,
    formatYearMonthJa,
    listSelectableMonths,
    listSelectableYears,
    parseYearMonth,
} from '../utils/year-month-picker.util';

@Component({
    selector: 'app-year-month-picker',
    standalone: true,
    imports: [FormsModule],
    template: `
        <div class="year-month-picker" [class.is-compact]="!showDisplayLabel()" [class.is-disabled]="disabled()">
            <div class="year-month-picker-controls" role="group" [attr.aria-label]="ariaLabel() || label() || '年月を選択'">
                <label class="sr-only" [attr.for]="inputId()">{{ label() || '年月' }}</label>
                <select
                    class="year-select"
                    [id]="inputId()"
                    [ngModel]="selectedYear()"
                    (ngModelChange)="onYearChange($event)"
                    [disabled]="disabled()"
                    aria-label="年"
                >
                    @for (year of yearOptions(); track year) {
                        <option [ngValue]="year">{{ year }}年</option>
                    }
                </select>
                <select
                    class="month-select"
                    [ngModel]="selectedMonth()"
                    (ngModelChange)="onMonthChange($event)"
                    [disabled]="disabled()"
                    aria-label="月"
                >
                    @for (month of monthOptions(); track month) {
                        <option [ngValue]="month">{{ month }}月</option>
                    }
                </select>
            </div>
            @if (showDisplayLabel()) {
                <p class="year-month-display" aria-hidden="true">{{ displayLabel() }}</p>
            }
        </div>
    `,
    styles: `
        .year-month-picker {
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 0;
        }

        .year-month-picker.is-compact .year-month-picker-controls {
            justify-content: center;
        }

        .year-month-picker.is-disabled {
            opacity: 0.6;
        }

        .year-month-picker-controls {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
        }

        .year-select,
        .month-select {
            height: 40px;
            padding: 0 12px;
            border: 1px solid #d1d5db;
            border-radius: 10px;
            background: #fff;
            color: #111827;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .year-select {
            min-width: 108px;
        }

        .month-select {
            min-width: 88px;
        }

        .year-select:hover:not(:disabled),
        .month-select:hover:not(:disabled) {
            border-color: #93c5fd;
        }

        .year-select:focus-visible,
        .month-select:focus-visible {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }

        .year-select:disabled,
        .month-select:disabled {
            cursor: not-allowed;
            background: #f9fafb;
        }

        .year-month-display {
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            color: #111827;
            letter-spacing: -0.01em;
            line-height: 1.2;
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

        @media (max-width: 640px) {
            .year-month-display {
                font-size: 18px;
            }
        }
    `,
})
export class YearMonthPickerComponent {
    value = input.required<string>();
    min = input<string | null>(null);
    max = input<string | null>(null);
    disabled = input(false);
    label = input('');
    ariaLabel = input('');
    inputId = input('target-year-month');
    showDisplayLabel = input(true);

    valueChange = output<string>();

    readonly selectedYear = signal(0);
    readonly selectedMonth = signal(1);

    constructor() {
        effect(() => {
            const parsed = parseYearMonth(this.value());
            if (!parsed) return;
            this.selectedYear.set(parsed.year);
            this.selectedMonth.set(parsed.month);
        });
    }

    displayLabel = computed(() => formatYearMonthJa(this.value()));

    yearOptions = computed(() => {
        const parsed = parseYearMonth(this.value());
        const fallbackYear = parsed?.year ?? new Date().getFullYear();
        return listSelectableYears(this.min(), this.max(), fallbackYear);
    });

    monthOptions = computed(() =>
        listSelectableMonths(this.selectedYear(), this.min(), this.max()),
    );

    onYearChange(year: number): void {
        const months = listSelectableMonths(year, this.min(), this.max());
        const month = months.includes(this.selectedMonth())
            ? this.selectedMonth()
            : months[months.length - 1] ?? 1;
        this.emitValue(year, month);
    }

    onMonthChange(month: number): void {
        this.emitValue(this.selectedYear(), month);
    }

    private emitValue(year: number, month: number): void {
        const next = clampYearMonth(formatYearMonth(year, month), this.min(), this.max());
        if (next !== this.value()) {
            this.valueChange.emit(next);
        }
    }
}
