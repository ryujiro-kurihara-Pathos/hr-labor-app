import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Employee } from '../models/employee.models';
import { EmployeeService } from '../services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';

@Component({
    selector: 'app-employee-paeg',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './employee-page.component.html',
})

export class EmployeePageComponent {
    private readonly employeeService = inject(EmployeeService);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);

    // ローディング
    isLoading = signal<boolean>(false);

    // 会社ID
    companyId = signal<string>('');

    // 従業員一覧
    employees = signal<Employee[]>([]);

    // 初期処理
    async ngOnInit() {
        // 会社IDを取得
        const authUser = this.authService.getCurrentAuthUser();
        if(!authUser) return;
        const appUser = await this.userService.getUserByUid(authUser.uid);
        if(!appUser) return;

        // 会社IDを設定
        this.companyId.set(appUser.companyId);

        // 従業員のロード
        await this.loadEmployees();
    }

    // 従業員のロード
    async loadEmployees(): Promise<void> {
        const companyId = this.companyId();
        if(!companyId) return;

        this.isLoading.set(true);
        
        try {
            // 従業員の取得
            const employees = await this.employeeService.getEmployeesByCompanyId(this.companyId());
            this.employees.set(employees);
        } catch (error) {
            this.employees.set([]);
            console.error('従業員の取得に失敗しました', error);
        } finally {
            this.isLoading.set(false);
        }
    }}