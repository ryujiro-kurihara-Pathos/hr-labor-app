import { Component, signal, inject, computed } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Employee } from '../models/employee.models';
import { EmployeeService } from '../services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { OfficeService } from '../../company/services/office.service';

@Component({
    selector: 'app-employee-paeg',
    standalone: true,
    imports: [RouterLink, FormsModule, KeyValuePipe],
    templateUrl: './employee-page.component.html',
})

export class EmployeePageComponent {
    private readonly employeeService = inject(EmployeeService);
    private readonly officeService = inject(OfficeService);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);

    // ローディング
    isLoading = signal<boolean>(false);

    // 会社ID
    companyId = signal<string>('');
    // 事業所名
    officeNameById = signal<Record<string, string>>({});

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

    // 従業員一覧
    employees = signal<Employee[]>([]);

    // 従業員のロード
    async loadEmployees(): Promise<void> {
        const companyId = this.companyId();
        if(!companyId) return;

        this.isLoading.set(true);
        
        try {
            // const cid = companyId;
            const [employees, offices] = await Promise.all([
                this.employeeService.getEmployeesByCompanyId(companyId),
                this.officeService.getOfficesByCompanyId(companyId),
            ]);
            this.employees.set(employees);

            const map: Record<string, string> = {};
            for (const office of offices) {
                map[office.id] = office.name;
            }
            this.officeNameById.set(map);
        } catch (error) {
            this.employees.set([]);
            this.officeNameById.set({});
            console.error('従業員の取得に失敗しました', error);
        } finally {
            this.isLoading.set(false);
        }
    }

    // 検索キーワード
    keyword = signal<string>('');

    // 事業所絞り込み（空文字はすべて）
    selectedOfficeId = signal<string>('');

    // 検索結果
    filteredEmployees = computed(() => this.searchEmployees());

    // 従業員を検索（keyword / selectedOfficeId / employees が変わるたび呼ばれる）
    searchEmployees(): Employee[] {
        const keyword = this.keyword().trim().toLowerCase();
        const officeId = this.selectedOfficeId();
        let list = this.employees();

        if (officeId) {
            list = list.filter((employee) => employee.officeId === officeId);
        }
        if (!keyword) return list;
        return list.filter(
            (employee) =>
                `${employee.lastName}${employee.firstName}`.toLowerCase().includes(keyword) ||
                employee.employeeNumber.toLowerCase().includes(keyword),
        );
    }
}