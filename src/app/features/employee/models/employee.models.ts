import { Timestamp } from 'firebase/firestore';

export type EmployeeStatus = 'active' | 'retired';
export type EmploymentType = 'full-time' | 'part-time' | null;

export type Employee = {
    id: string;                     // 従業員ID

    // 会社・事業所紐づけ
    companyId: string;              // 会社ID
    officeId: string;               // 事業所ID

    // 基本情報
    employeeNumber: string;         // 社員番号
    lastName: string;               // 姓
    firstName: string;              // 名
    birthDate: string;              // 生年月日（YYYY-MM-DD）
    joinedDate: string;             // 入社日（YYYY-MM-DD）

    // 雇用情報
    employmentType: EmploymentType; // 雇用区分

    // 所属・人事情報
    department: string;             // 部署
    position: string;               // 役職

    // 在籍状態
    status: EmployeeStatus;         // 在籍状態
    retiredDate: Timestamp | null;  // 退職日

    // 作成・更新日時
    createdAt: Timestamp;           // 作成日時
    updatedAt: Timestamp;           // 更新日時
};

export type EmployeeInput = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;