import { Component, input } from '@angular/core';

@Component({
    selector: 'app-field-help-tooltip',
    standalone: true,
    template: `
        <span
            class="help-mark"
            tabindex="0"
            [attr.aria-label]="ariaLabel() || title() || '項目の説明'"
        >
            <span class="help-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="8.25" stroke="currentColor" stroke-width="1.5" />
                    <path d="M10 9.2V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    <circle cx="10" cy="6.4" r="0.9" fill="currentColor" />
                </svg>
            </span>
            <span class="help-tooltip" role="tooltip">
                @if (title()) {
                    <span class="help-tooltip-title">{{ title() }}</span>
                }
                @if (lines().length > 0) {
                    <ul class="help-tooltip-list">
                        @for (line of lines(); track line) {
                            <li>{{ line }}</li>
                        }
                    </ul>
                } @else {
                    <p class="help-tooltip-text"><ng-content /></p>
                }
            </span>
        </span>
    `,
    styles: `
        :host {
            display: inline-flex;
            vertical-align: middle;
        }

        .help-mark {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            cursor: help;
            outline: none;
        }

        .help-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: #fff;
            color: #64748b;
            border: 1px solid #dbe3ee;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
            transition: border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s;
        }

        .help-icon svg {
            width: 14px;
            height: 14px;
        }

        .help-mark:hover .help-icon,
        .help-mark:focus-visible .help-icon {
            border-color: #93c5fd;
            color: #2563eb;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
            transform: translateY(-1px);
        }

        .help-tooltip {
            position: absolute;
            bottom: calc(100% + 10px);
            left: 50%;
            z-index: 30;
            width: min(300px, 72vw);
            padding: 12px 14px;
            border-radius: 12px;
            background: #fff;
            color: #475569;
            border: 1px solid #e2e8f0;
            box-shadow:
                0 12px 28px rgba(15, 23, 42, 0.12),
                0 2px 6px rgba(15, 23, 42, 0.06);
            opacity: 0;
            visibility: hidden;
            transform: translate(-50%, 6px);
            transition: opacity 0.18s ease, visibility 0.18s ease, transform 0.18s ease;
            pointer-events: none;
        }

        .help-tooltip::after {
            content: '';
            position: absolute;
            bottom: -7px;
            left: 50%;
            width: 12px;
            height: 12px;
            margin-left: -6px;
            background: #fff;
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            transform: rotate(45deg);
        }

        .help-tooltip-title {
            display: block;
            margin-bottom: 6px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.02em;
            color: #1e293b;
        }

        .help-tooltip-list {
            margin: 0;
            padding-left: 18px;
            font-size: 12px;
            line-height: 1.65;
        }

        .help-tooltip-list li + li {
            margin-top: 6px;
        }

        .help-tooltip-text {
            margin: 0;
            font-size: 12px;
            line-height: 1.65;
        }

        .help-mark:hover .help-tooltip,
        .help-mark:focus-visible .help-tooltip {
            opacity: 1;
            visibility: visible;
            transform: translate(-50%, 0);
        }
    `,
})
export class FieldHelpTooltipComponent {
    title = input('');
    lines = input<string[]>([]);
    ariaLabel = input('');
}
