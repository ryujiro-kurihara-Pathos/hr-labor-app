import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'labor' | 'employee';

export type UserStatus = 'active' | 'inactive';

export type AppUser = {
    uid: string; // ユーザーID
    lastName: string; // 姓
    firstName: string; // 名
    email: string; // メールアドレス

    role: UserRole; // ユーザーの役割
    status: UserStatus; // ユーザーのステータス

    createdAt: Timestamp; // 作成日時
    updatedAt: Timestamp; // 更新日時

    companyId: string; // 会社ID
    employeeId: string | null; // 従業員ID
}

export type AppUserInput = Omit<AppUser, 'createdAt' | 'updatedAt'>;
