import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EmploymentType } from '../../employee/models/employee.models';
import { SocialInsuranceStatus } from '../models/social-insurance-status.model';
import {
    getMissingPartTimeJudgmentFields,
    isPartTimeEmployment,
    partTimeInsuranceJudgmentWarningMessage,
    PartTimeInsuranceJudgmentInput,
    partTimeJudgmentInputFromStatus,
} from '../utils/part-time-insurance-judgment.util';

@Component({
    selector: 'app-part-time-insurance-warning',
    standalone: true,
    imports: [RouterLink],
    template: `
        @if (visible()) {
            <div class="part-time-warning" role="status">
                <p class="part-time-warning-title">社会保険の加入対象を判定できません</p>
                <p class="part-time-warning-message">{{ warningMessage() }}</p>
                @if (employeeId()) {
                    <a
                        [routerLink]="['/employees', employeeId()]"
                        fragment="social-insurance"
                        class="part-time-warning-link"
                    >
                        労働条件設定画面へ
                    </a>
                }
            </div>
        }
    `,
    styles: `
        .part-time-warning {
            margin: 0 0 16px;
            padding: 14px 16px;
            border-radius: 10px;
            background: #fffbeb;
            border: 1px solid #fde68a;
        }

        .part-time-warning-title {
            margin: 0 0 6px;
            font-size: 14px;
            font-weight: 700;
            color: #92400e;
        }

        .part-time-warning-message {
            margin: 0;
            font-size: 13px;
            line-height: 1.6;
            color: #78350f;
        }

        .part-time-warning-link {
            display: inline-block;
            margin-top: 10px;
            font-size: 13px;
            font-weight: 600;
            color: #b45309;
            text-decoration: underline;
        }

        .part-time-warning-link:hover {
            color: #92400e;
        }
    `,
})
export class PartTimeInsuranceWarningComponent {
    employeeId = input<string | null>(null);
    employmentType = input<EmploymentType>(null);
    status = input<SocialInsuranceStatus | null>(null);
    /** 編集中の入力値。未指定時は status から判定 */
    judgmentInput = input<PartTimeInsuranceJudgmentInput | null>(null);

    private resolvedInput = computed(
        (): PartTimeInsuranceJudgmentInput =>
            this.judgmentInput() ?? partTimeJudgmentInputFromStatus(this.status()),
    );

    visible = computed(() => {
        if (!isPartTimeEmployment(this.employmentType())) return false;
        return getMissingPartTimeJudgmentFields(this.resolvedInput()).length > 0;
    });

    warningMessage = computed(() =>
        partTimeInsuranceJudgmentWarningMessage(
            getMissingPartTimeJudgmentFields(this.resolvedInput()),
        ),
    );
}
