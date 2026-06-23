import { Component, ViewEncapsulation, input } from '@angular/core';

@Component({
    selector: 'app-employee-portal-page',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    template: `
        <div class="employee-portal">
            <header class="employee-portal__header">
                <h1 class="employee-portal__title">{{ title() }}</h1>
                @if (note()) {
                    <p class="employee-portal__note">{{ note() }}</p>
                }
            </header>
            <div class="employee-portal__content">
                <ng-content />
            </div>
        </div>
    `,
    styles: [`
        .employee-portal {
            max-width: 840px;
            margin: 0 auto;
            padding: 4px 0 48px;
        }

        .employee-portal__header {
            margin-bottom: 4px;
        }

        .employee-portal__title {
            margin: 0 0 8px;
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #0f172a;
            line-height: 1.25;
        }

        .employee-portal__note {
            margin: 0;
            max-width: 56ch;
            font-size: 14px;
            line-height: 1.65;
            color: #64748b;
        }

        .employee-portal__content {
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        .ep-quick-nav {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 20px;
        }

        .ep-quick-nav__link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            border: 1px solid #d1fae5;
            border-radius: 12px;
            background: #fff;
            color: #047857;
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
            transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }

        .ep-quick-nav__link:hover {
            border-color: #6ee7b7;
            background: #ecfdf5;
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.1);
        }

        .ep-quick-nav__link.is-active {
            border-color: #059669;
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            color: #065f46;
        }

        .ep-quick-nav__icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 8px;
            background: #d1fae5;
            font-size: 12px;
            font-weight: 800;
        }

        .ep-state {
            margin: 20px 0 0;
            padding: 16px 18px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.6;
        }

        .ep-state--loading {
            background: #fff;
            border: 1px solid #e2e8f0;
            color: #64748b;
        }

        .ep-state--error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #b91c1c;
        }

        .ep-state--warning {
            background: #fffbeb;
            border: 1px solid #fde68a;
            color: #92400e;
        }

        .ep-state--info {
            background: #fff7ed;
            border: 1px solid #fed7aa;
            color: #9a3412;
        }

        .ep-state--muted {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            color: #64748b;
        }

        .ep-card {
            padding: 20px 22px;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
        }

        .ep-card + .ep-card,
        .ep-section-gap {
            margin-top: 16px;
        }

        .ep-card__title {
            margin: 0 0 14px;
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
        }

        .ep-card__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
        }

        .ep-card__header .ep-card__title {
            margin: 0;
        }

        .ep-card__meta {
            font-size: 13px;
            font-weight: 600;
            color: #64748b;
        }

        .ep-card__empty {
            margin: 0;
            font-size: 14px;
            color: #64748b;
            line-height: 1.6;
        }

        .ep-link {
            color: #059669;
            font-weight: 600;
            text-decoration: none;
        }

        .ep-link:hover {
            text-decoration: underline;
        }

        .ep-link--arrow::after {
            content: ' →';
        }

        .ep-hero {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-top: 20px;
            padding: 24px;
            border: 1px solid #bbf7d0;
            border-radius: 18px;
            background: linear-gradient(135deg, #ecfdf5 0%, #f8fafc 55%, #fff 100%);
            box-shadow: 0 4px 16px rgba(5, 150, 105, 0.08);
        }

        .ep-hero__avatar {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 72px;
            height: 72px;
            border-radius: 999px;
            background: linear-gradient(135deg, #059669 0%, #34d399 100%);
            color: #fff;
            font-size: 28px;
            font-weight: 800;
            flex-shrink: 0;
            box-shadow: 0 8px 20px rgba(5, 150, 105, 0.22);
        }

        .ep-hero__body {
            min-width: 0;
        }

        .ep-hero__kicker {
            margin: 0 0 4px;
            font-size: 12px;
            font-weight: 600;
            color: #059669;
        }

        .ep-hero__name {
            margin: 0;
            font-size: 24px;
            line-height: 1.3;
            color: #0f172a;
        }

        .ep-hero__sub {
            margin: 4px 0 12px;
            font-size: 14px;
            color: #64748b;
        }

        .ep-hero__badges {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .ep-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
        }

        .ep-badge--neutral {
            background: #f1f5f9;
            color: #475569;
        }

        .ep-badge--success {
            background: #dcfce7;
            color: #166534;
        }

        .ep-badge--warning {
            background: #fef3c7;
            color: #92400e;
        }

        .ep-badge--info {
            background: #dbeafe;
            color: #1d4ed8;
        }

        .ep-badge--danger {
            background: #fee2e2;
            color: #991b1b;
        }

        .ep-grid-2 {
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
            margin-top: 16px;
        }

        @media (min-width: 720px) {
            .ep-grid-2 {
                grid-template-columns: 1fr 1fr;
            }
        }

        .ep-month-context {
            margin: 0;
            text-align: center;
            font-size: 13px;
            color: #64748b;
            line-height: 1.5;
        }

        .ep-month-context strong {
            color: #334155;
            font-weight: 700;
        }

        .ep-month-context__sep {
            margin: 0 6px;
            color: #cbd5e1;
        }

        .ep-period-hint {
            margin: 16px 0 0;
            padding: 10px 14px;
            border-radius: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            font-size: 13px;
            font-weight: 600;
            color: #64748b;
        }
    `],
})
export class EmployeePortalPageComponent {
    readonly title = input.required<string>();
    readonly note = input<string>('');
}
