import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Procedure } from '../models/procedures.model';
import {
    dateLabel,
    isProcedureOverdue,
    procedureStatusLabel,
    procedureTypeLabel,
    procedureTypeMeta,
    todayDateString,
} from '../utils/procedure-display.util';

@Component({
    selector: 'app-procedure-detail-header',
    standalone: true,
    imports: [RouterLink],
    template: `
        <header class="procedure-hero">
            <div class="procedure-hero-nav">
                <a routerLink="/procedures" class="back-link">← 手続き一覧</a>
                <div class="procedure-hero-tags">
                    <span
                        class="status-badge"
                        [class.not-started]="procedure().status === 'notStarted'"
                        [class.completed]="procedure().status === 'completed'"
                    >
                        {{ procedureStatusLabel(procedure().status) }}
                    </span>
                    @if (procedure().dueDate) {
                        <span class="due-badge" [class.overdue]="isOverdue()">
                            期限 {{ dateLabel(procedure().dueDate) }}
                        </span>
                    }
                </div>
            </div>

            <div class="procedure-hero-body">
                <span class="type-icon tone-{{ typeMeta().tone }}" aria-hidden="true">
                    {{ typeMeta().icon }}
                </span>
                <div class="procedure-hero-text">
                    <p class="procedure-hero-kicker">{{ procedureTypeLabel(procedure().procedureType) }}</p>
                    <h1 class="procedure-hero-title">{{ formTitle() || procedureTypeLabel(procedure().procedureType) }}</h1>
                    @if (subjectLabel()) {
                        @if (employeeId()) {
                            <a class="procedure-hero-subject procedure-hero-subject-link" [routerLink]="employeeDetailLink()">
                                {{ subjectLabel() }}
                            </a>
                        } @else {
                            <p class="procedure-hero-subject">{{ subjectLabel() }}</p>
                        }
                    }
                </div>
            </div>

            <div class="procedure-hero-actions">
                <ng-content />
            </div>
        </header>
    `,
    styles: `
        .procedure-hero {
            margin-bottom: 24px;
            padding: 18px 20px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .procedure-hero-nav {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 16px;
        }

        .back-link {
            font-size: 13px;
            font-weight: 600;
            color: #2563eb;
            text-decoration: none;
        }

        .back-link:hover {
            text-decoration: underline;
        }

        .procedure-hero-tags {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
        }

        .status-badge,
        .due-badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
        }

        .status-badge.not-started {
            background: #f3f4f6;
            color: #4b5563;
        }

        .status-badge.completed {
            background: #dcfce7;
            color: #166534;
        }

        .due-badge {
            background: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
        }

        .due-badge.overdue {
            background: #fef2f2;
            color: #b91c1c;
            border-color: #fecaca;
        }

        .procedure-hero-body {
            display: flex;
            align-items: flex-start;
            gap: 14px;
        }

        .type-icon {
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            border-radius: 14px;
            font-size: 17px;
            font-weight: 800;
            color: #fff;
            box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
        }

        .tone-blue { background: #2563eb; }
        .tone-rose { background: #e11d48; }
        .tone-violet { background: #7c3aed; }
        .tone-amber { background: #d97706; }
        .tone-orange { background: #ea580c; }
        .tone-green { background: #059669; }
        .tone-slate { background: #475569; }

        .procedure-hero-text {
            min-width: 0;
        }

        .procedure-hero-kicker {
            margin: 0 0 4px;
            font-size: 12px;
            font-weight: 700;
            color: #6b7280;
            letter-spacing: 0.02em;
        }

        .procedure-hero-title {
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            color: #111827;
            line-height: 1.3;
        }

        .procedure-hero-subject {
            margin: 6px 0 0;
            font-size: 14px;
            font-weight: 600;
            color: #374151;
        }

        .procedure-hero-subject-link {
            display: inline-block;
            text-decoration: none;
            color: #2563eb;
        }

        .procedure-hero-subject-link:hover {
            text-decoration: underline;
        }

        .procedure-hero-actions {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
        }
    `,
})
export class ProcedureDetailHeaderComponent {
    procedure = input.required<Procedure>();
    formTitle = input('');
    subjectLabel = input('');
    employeeId = input('');

    readonly procedureTypeLabel = procedureTypeLabel;
    readonly procedureStatusLabel = procedureStatusLabel;
    readonly dateLabel = dateLabel;

    typeMeta = computed(() => procedureTypeMeta(this.procedure().procedureType));

    employeeDetailLink = computed((): string[] => {
        const id = this.employeeId() || this.procedure().employeeId;
        return id ? ['/employees', id] : [];
    });

    isOverdue = computed(() =>
        isProcedureOverdue(this.procedure(), todayDateString()),
    );
}
