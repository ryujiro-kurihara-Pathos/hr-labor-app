import { Component, computed, input, output } from '@angular/core';

import { formatYearMonthJa } from '../utils/year-month-picker.util';
import { YearMonthPickerComponent } from './year-month-picker.component';

@Component({
    selector: 'app-month-navigation-bar',
    standalone: true,
    imports: [YearMonthPickerComponent],
    template: `
        <section
            class="month-nav-bar"
            [class.is-loading]="loading()"
            [attr.aria-busy]="loading()"
        >
            <button
                type="button"
                class="month-nav-bar__arrow"
                (click)="prevMonth.emit()"
                [disabled]="loading() || disabled() || !canGoPrev()"
                aria-label="前の月へ"
            >
                <svg viewBox="0 0 20 20" aria-hidden="true" class="month-nav-bar__icon">
                    <path d="M12.5 15L7.5 10L12.5 5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>

            <div class="month-nav-bar__body">
                <p class="month-nav-bar__label">{{ label() }}</p>
                <p class="month-nav-bar__display" aria-live="polite">{{ displayLabel() }}</p>
                <div class="month-nav-bar__controls">
                    <app-year-month-picker
                        [inputId]="inputId()"
                        [label]="label()"
                        [value]="value()"
                        [min]="min()"
                        [max]="max()"
                        [disabled]="disabled() || loading()"
                        [showDisplayLabel]="false"
                        (valueChange)="valueChange.emit($event)"
                    />
                    <div class="month-nav-bar__actions">
                        <ng-content select="[monthNavActions]" />
                    </div>
                </div>
                <div class="month-nav-bar__footer">
                    <ng-content select="[monthNavFooter]" />
                </div>
            </div>

            <button
                type="button"
                class="month-nav-bar__arrow"
                (click)="nextMonth.emit()"
                [disabled]="loading() || disabled() || !canGoNext()"
                aria-label="次の月へ"
            >
                <svg viewBox="0 0 20 20" aria-hidden="true" class="month-nav-bar__icon">
                    <path d="M7.5 15L12.5 10L7.5 5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
        </section>
    `,
    styles: `
        :host {
            display: block;
        }

        .month-nav-bar {
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: 12px;
            margin: 20px 0 24px;
            padding: 16px 18px;
            background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .month-nav-bar.is-loading {
            opacity: 0.72;
            pointer-events: none;
        }

        .month-nav-bar__arrow {
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border: 1px solid #d1d5db;
            border-radius: 12px;
            background: #fff;
            color: #374151;
            cursor: pointer;
            transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }

        .month-nav-bar__arrow:hover:not(:disabled) {
            background: #eff6ff;
            border-color: #93c5fd;
            color: #2563eb;
            box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08);
        }

        .month-nav-bar__arrow:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .month-nav-bar__icon {
            width: 20px;
            height: 20px;
        }

        .month-nav-bar__body {
            min-width: 0;
            text-align: center;
        }

        .month-nav-bar__label {
            margin: 0 0 4px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6b7280;
        }

        .month-nav-bar__display {
            margin: 0 0 10px;
            font-size: clamp(1.35rem, 2.8vw, 1.75rem);
            font-weight: 800;
            line-height: 1.15;
            color: #111827;
            letter-spacing: -0.02em;
        }

        .month-nav-bar__controls {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            gap: 10px 12px;
        }

        .month-nav-bar__actions {
            display: inline-flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .month-nav-bar__actions:empty {
            display: none;
        }

        .month-nav-bar__footer {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #eef2f7;
            font-size: 13px;
            line-height: 1.5;
            color: #64748b;
        }

        .month-nav-bar__footer:empty {
            display: none;
        }

        @media (max-width: 640px) {
            .month-nav-bar {
                gap: 8px;
                padding: 14px 12px;
            }

            .month-nav-bar__arrow {
                width: 40px;
                height: 40px;
            }

            .month-nav-bar__controls {
                flex-direction: column;
            }
        }
    `,
})
export class MonthNavigationBarComponent {
    label = input('対象年月');
    inputId = input('target-year-month');
    value = input.required<string>();
    min = input<string | null>(null);
    max = input<string | null>(null);
    disabled = input(false);
    loading = input(false);
    canGoPrev = input(true);
    canGoNext = input(true);

    valueChange = output<string>();
    prevMonth = output<void>();
    nextMonth = output<void>();

    displayLabel = computed(() => formatYearMonthJa(this.value()));
}
