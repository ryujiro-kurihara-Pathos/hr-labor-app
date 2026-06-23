import { Component, ViewEncapsulation, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-admin-page-shell',
    standalone: true,
    imports: [RouterLink],
    encapsulation: ViewEncapsulation.None,
    template: `
        <div class="admin-page">
            @if (backLink()) {
                <a [routerLink]="backLink()!" class="admin-page__back">{{ backLabel() }}</a>
            }
            <header class="admin-page__header">
                <h1 class="admin-page__title">{{ title() }}</h1>
                @if (note()) {
                    <p class="admin-page__note">{{ note() }}</p>
                }
            </header>
            <div class="admin-page__content">
                <ng-content />
            </div>
        </div>
    `,
    styles: [`
        .admin-page {
            max-width: 920px;
            margin: 0 auto;
            padding: 4px 0 48px;
        }

        .admin-page__back {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-bottom: 16px;
            color: #2563eb;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
        }

        .admin-page__back:hover {
            text-decoration: underline;
        }

        .admin-page__header {
            margin-bottom: 4px;
        }

        .admin-page__title {
            margin: 0 0 8px;
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #0f172a;
            line-height: 1.25;
        }

        .admin-page__note {
            margin: 0;
            max-width: 60ch;
            font-size: 14px;
            line-height: 1.65;
            color: #64748b;
        }

        .admin-page__content {
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        .admin-section {
            margin-top: 28px;
        }

        .admin-section__header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 14px;
        }

        .admin-section__header-main {
            min-width: 0;
        }

        .admin-section__title {
            margin: 0 0 4px;
            font-size: 17px;
            font-weight: 700;
            color: #0f172a;
        }

        .admin-section__note {
            margin: 0;
            font-size: 13px;
            color: #64748b;
        }

        .admin-card {
            padding: 22px 24px;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
        }

        .admin-card + .admin-card,
        .admin-card-gap {
            margin-top: 14px;
        }

        .admin-card--featured {
            background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 55%, #fff 100%);
            border-color: #bfdbfe;
            box-shadow: 0 4px 16px rgba(37, 99, 235, 0.08);
        }

        .admin-card__subheading {
            margin: 0 0 12px;
            font-size: 14px;
            font-weight: 700;
            color: #334155;
        }

        .admin-card__divider {
            margin: 20px 0;
            border: none;
            border-top: 1px solid #e2e8f0;
        }

        .admin-state {
            margin: 20px 0 0;
            padding: 16px 18px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.6;
        }

        .admin-state--loading {
            background: #fff;
            border: 1px solid #e2e8f0;
            color: #64748b;
        }

        .admin-state--error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #b91c1c;
        }

        .admin-empty {
            padding: 36px 24px;
            text-align: center;
            border: 1px dashed #cbd5e1;
            border-radius: 16px;
            background: #f8fafc;
        }

        .admin-empty__title {
            margin: 0 0 6px;
            font-size: 15px;
            font-weight: 700;
            color: #334155;
        }

        .admin-empty__note {
            margin: 0;
            font-size: 14px;
            color: #64748b;
        }

        .admin-meta {
            margin: 0;
            display: grid;
            gap: 0;
        }

        .admin-meta__row {
            display: grid;
            grid-template-columns: 120px 1fr;
            gap: 12px;
            padding: 11px 0;
            border-bottom: 1px solid #f1f5f9;
            font-size: 14px;
            line-height: 1.5;
        }

        .admin-meta__row:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }

        .admin-meta__row:first-child {
            padding-top: 0;
        }

        .admin-meta__row dt {
            margin: 0;
            color: #64748b;
            font-weight: 600;
        }

        .admin-meta__row dd {
            margin: 0;
            color: #0f172a;
            word-break: break-word;
        }

        .admin-badge {
            display: inline-flex;
            align-items: center;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
        }

        .admin-badge--success {
            background: #dcfce7;
            color: #166534;
        }

        .admin-badge--muted {
            background: #f1f5f9;
            color: #475569;
        }

        .admin-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 40px;
            padding: 0 16px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        }

        .admin-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .admin-btn--primary {
            border: none;
            background: #2563eb;
            color: #fff;
        }

        .admin-btn--primary:hover:not(:disabled) {
            background: #1d4ed8;
        }

        .admin-btn--secondary {
            border: 1px solid #d1d5db;
            background: #fff;
            color: #374151;
        }

        .admin-btn--secondary:hover:not(:disabled) {
            background: #f9fafb;
        }

        .admin-btn--ghost {
            border: 1px solid #2563eb;
            background: #fff;
            color: #2563eb;
        }

        .admin-btn--ghost:hover:not(:disabled) {
            background: #eff6ff;
        }

        .admin-btn--success {
            border: none;
            background: #dcfce7;
            color: #166534;
        }

        .admin-btn--success:hover:not(:disabled) {
            background: #bbf7d0;
        }

        .admin-form-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
        }

        @media (max-width: 640px) {
            .admin-section__header {
                flex-direction: column;
                align-items: stretch;
            }

            .admin-meta__row {
                grid-template-columns: 1fr;
                gap: 4px;
            }

            .admin-form-actions .admin-btn {
                flex: 1;
            }
        }
    `],
})
export class AdminPageShellComponent {
    readonly title = input.required<string>();
    readonly note = input<string>('');
    readonly backLink = input<string | null>(null);
    readonly backLabel = input('← 戻る');
}
