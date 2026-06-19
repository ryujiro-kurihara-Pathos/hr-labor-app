import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { CompanyService } from '../../company/services/company.service';
import { OfficeService } from '../../company/services/office.service';
import { EmployeeService } from '../../employee/services/employee.service';
import { SocialInsuranceProcedureService } from '../../social-insurance/services/social-insurance-procedure.service';
import { Procedure } from '../../social-insurance/models/procedures.model';
import {
    procedureStatusLabel,
    procedureTypeLabel,
} from '../../social-insurance/utils/procedure-display.util';
import { AppUser } from '../../users/models/user.model';

type QuickMenuItem = {
    label: string;
    description: string;
    route: string;
    icon: string;
    tone: 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'slate';
};

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './home-page.component.html',
})
export class HomePageComponent {
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
    private readonly companyService = inject(CompanyService);
    private readonly officeService = inject(OfficeService);
    private readonly employeeService = inject(EmployeeService);
    private readonly procedureService = inject(SocialInsuranceProcedureService);

    readonly procedureTypeLabel = procedureTypeLabel;
    readonly procedureStatusLabel = procedureStatusLabel;

    isLoading = signal(true);
    errorMessage = signal('');

    currentUser = signal<AppUser | null>(null);
    companyName = signal('');
    employeeCount = signal(0);
    activeEmployeeCount = signal(0);
    officeCount = signal(0);
    procedures = signal<Procedure[]>([]);
    employeeNameById = signal<Record<string, string>>({});

    todayLabel = computed(() => this.formatTodayLabel(new Date()));

    pendingProcedureCount = computed(
        () => this.procedures().filter((p) => p.status !== 'completed').length,
    );

    overdueProcedureCount = computed(() => this.overdueProcedures().length);

    overdueProcedures = computed(() => {
        const today = this.todayString();
        return this.procedures()
            .filter((p) => p.status !== 'completed' && p.dueDate && p.dueDate < today)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    });

    actionProcedures = computed(() => {
        const today = this.todayString();
        return this.procedures()
            .filter((p) => p.status !== 'completed')
            .sort((a, b) => {
                const aOverdue = a.dueDate && a.dueDate < today ? 0 : 1;
                const bOverdue = b.dueDate && b.dueDate < today ? 0 : 1;
                if (aOverdue !== bOverdue) return aOverdue - bOverdue;
                if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
                if (a.dueDate) return -1;
                if (b.dueDate) return 1;
                return 0;
            })
            .slice(0, 5);
    });

    quickMenuItems: QuickMenuItem[] = [
        {
            label: '従業員を追加',
            description: '新規登録',
            route: '/employees/new',
            icon: '＋',
            tone: 'blue',
        },
        {
            label: '従業員管理',
            description: '一覧・検索',
            route: '/employees',
            icon: '員',
            tone: 'green',
        },
        {
            label: '報酬入力',
            description: '月次・賞与',
            route: '/rewards',
            icon: '酬',
            tone: 'amber',
        },
        {
            label: '保険料',
            description: '給与控除',
            route: '/premium',
            icon: '算',
            tone: 'rose',
        },
        {
            label: '手続き',
            description: '届出・対応',
            route: '/procedures',
            icon: '届',
            tone: 'violet',
        },
        {
            label: '会社・事業所',
            description: '基本情報',
            route: '/company',
            icon: '社',
            tone: 'slate',
        },
        {
            label: 'プロフィール',
            description: 'アカウント',
            route: '/profile',
            icon: '私',
            tone: 'rose',
        },
    ];

    async ngOnInit(): Promise<void> {
        await this.loadDashboard();
    }

    greetingName(): string {
        const user = this.currentUser();
        if (!user) return 'ようこそ';
        const name = `${user.lastName} ${user.firstName}`.trim();
        return name || 'ようこそ';
    }

    employeeName(employeeId: string | null): string {
        if (!employeeId) return '—';
        return this.employeeNameById()[employeeId] ?? '従業員';
    }

    formatDueDate(date: string): string {
        if (!date) return '期限未設定';
        const [y, m, d] = date.split('-');
        if (!y || !m || !d) return date;
        return `${y}/${m}/${d}`;
    }

    isOverdue(procedure: Procedure): boolean {
        return Boolean(
            procedure.status !== 'completed' &&
                procedure.dueDate &&
                procedure.dueDate < this.todayString(),
        );
    }

    private async loadDashboard(): Promise<void> {
        this.isLoading.set(true);
        this.errorMessage.set('');

        try {
            const authUser = this.authService.getCurrentAuthUser();
            if (!authUser) return;

            const appUser = await this.userService.getUserByUid(authUser.uid);
            if (!appUser) {
                this.errorMessage.set('ユーザー情報の取得に失敗しました');
                return;
            }

            this.currentUser.set(appUser);

            const [company, offices, employees, procedures] = await Promise.all([
                this.companyService.getCompanyById(appUser.companyId),
                this.officeService.getOfficesByCompanyId(appUser.companyId),
                this.employeeService.getEmployeesByCompanyId(appUser.companyId),
                this.procedureService.getProcedures(),
            ]);

            this.companyName.set(company?.name ?? '');
            this.officeCount.set(offices.length);
            this.employeeCount.set(employees.length);
            this.activeEmployeeCount.set(employees.filter((e) => e.status === 'active').length);

            const nameMap: Record<string, string> = {};
            for (const employee of employees) {
                nameMap[employee.id] = `${employee.lastName} ${employee.firstName}`;
            }
            this.employeeNameById.set(nameMap);

            this.procedures.set(
                procedures.filter((procedure) => procedure.companyId === appUser.companyId),
            );
        } catch (error) {
            console.error('ホーム画面の読み込みに失敗しました', error);
            this.errorMessage.set('データの取得に失敗しました');
        } finally {
            this.isLoading.set(false);
        }
    }

    private todayString(): string {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    private formatTodayLabel(date: Date): string {
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const w = weekdays[date.getDay()];
        return `${y}年${m}月${d}日（${w}）`;
    }
}
