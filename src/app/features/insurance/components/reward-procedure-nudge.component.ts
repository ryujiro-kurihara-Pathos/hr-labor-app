import { Component, input, output } from '@angular/core';

export type RewardProcedureNudgeTone = 'blue' | 'orange' | 'amber' | 'green';

@Component({
    selector: 'app-reward-procedure-nudge',
    standalone: true,
    templateUrl: './reward-procedure-nudge.component.html',
})
export class RewardProcedureNudgeComponent {
    icon = input.required<string>();
    tone = input<RewardProcedureNudgeTone>('blue');
    label = input.required<string>();
    summary = input<string | null>(null);
    overdue = input(false);
    exists = input(false);
    creating = input(false);

    action = output<void>();

    onAction(): void {
        if (this.creating()) return;
        this.action.emit();
    }
}
