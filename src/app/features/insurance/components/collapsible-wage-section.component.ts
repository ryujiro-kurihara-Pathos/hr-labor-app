import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
    selector: 'app-collapsible-wage-section',
    standalone: true,
    imports: [DecimalPipe],
    templateUrl: './collapsible-wage-section.component.html',
})
export class CollapsibleWageSectionComponent {
    title = input.required<string>();
    hint = input('');
    totalAmount = input.required<number>();
    expanded = input(false);
    variant = input<'fixed' | 'variable'>('variable');

    toggle = output<void>();
}
