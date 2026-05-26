import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { EmployeeInput } from '../models/employee.models';
import { EmployeeService } from '../services/employee.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';

@Component({
    selector: 'app-employee-create-page',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './employee-create-page.component.html',
})

export class EmployeeCreatePageComponent {
    private readonly employeeService = inject(EmployeeService);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);

    // ローディング
    isLoading = signal<boolean>(false);

    // 追加する従業員情報
    employee: EmployeeInput = {
        companyId: '',
        officeId: '',
        employeeNumber: '',
        lastName: '',
        firstName: '',
        birthDate: '',
        joinedDate: '',
        department: '',
        position: '',
        status: 'active',
        retiredDate: null,
    };

    async ngOnInit() {
        this.updateJoinedDate();

        const authUser = this.authService.getCurrentAuthUser();
        if (!authUser) return;

        const appUser = await this.userService.getUserByUid(authUser.uid);
        if (!appUser) return;

        this.employee.companyId = appUser.companyId;
    }

    // 入社日
    joinedYear = new Date().getFullYear();
    joinedMonth = new Date().getMonth() + 1;
    joinedDay = new Date().getDate();
    readonly joinYears = Array.from({ length: 51 }, (_, i) => new Date().getFullYear() - 25 + i);
    // 入社日を更新
    updateJoinedDate(): void {
        const month = String(this.joinedMonth).padStart(2, '0');
        const day = String(this.joinedDay).padStart(2, '0');
        this.employee.joinedDate = `${this.joinedYear}-${month}-${day}`;
    }

    // 従業員の追加ローディング
    isLoadingEmployee = signal<boolean>(false);
    errorMessage = signal<string>('');

    // 従業員を追加
    async onCreateEmployee() {

        this.isLoadingEmployee.set(true);
        this.errorMessage.set('');

        if(this.isFormEmpty(this.employee.lastName) || this.isFormEmpty(this.employee.firstName) || this.isFormEmpty(this.employee.birthDate) || this.isFormEmpty(this.employee.joinedDate)) {
            this.errorMessage.set('必須項目を入力してください。');
            this.isLoadingEmployee.set(false);
            return;
        }

        try {
            await this.employeeService.createEmployee(this.employee);

            // 従業員の追加成功
            this.errorMessage.set('');
            this.router.navigate(['/employees']);
        } catch (error) {
            this.errorMessage.set('従業員の追加に失敗しました。');
            console.error('従業員の追加に失敗しました。', error);
        } finally {
            this.isLoadingEmployee.set(false);
        }
    }

    // フォームが空白かどうか
    isFormEmpty(value: string): boolean {
        return value.trim() === '';
    }
}