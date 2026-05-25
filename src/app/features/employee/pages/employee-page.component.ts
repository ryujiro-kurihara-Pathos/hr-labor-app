import { Component, signal } from '@angular/core';

@Component({
    selector: 'app-employee-paeg',
    standalone: true,
    imports: [],
    templateUrl: './employee-page.component.html',
})

export class EmployeePageComponent {
    isLoading = signal<boolean>(false);
}