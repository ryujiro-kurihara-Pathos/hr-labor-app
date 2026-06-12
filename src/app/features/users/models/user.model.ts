import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'employee';

export type UserStatus = 'active' | 'inactive';

export type AppUser = {
    id: string; // ドキュメントID（uid と同じ）
    uid: string; // ユーザーID
    lastName: string; // 姓
    firstName: string; // 名
    lastNameKana: string; // 姓（カナ）
    firstNameKana: string; // 名（カナ）
    email: string; // メールアドレス

    role: UserRole; // ユーザーの役割
    status: UserStatus; // ユーザーのステータス

    createdAt: Timestamp; // 作成日時
    updatedAt: Timestamp; // 更新日時

    companyId: string; // 会社ID
    employeeId: string | null; // 従業員ID
}

export type AppUserInput = Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'>;
