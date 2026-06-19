import { Timestamp } from 'firebase/firestore';



export type EmployeeStatus = 'active' | 'retired';

export type EmploymentType = 'full-time' | 'part-time' | null;



export type Dependent = {
    id: string;                     // 扶養家族ID

    lastName: string;               // 姓
    firstName: string;              // 名
    birthDate: string;             // 生年月日（YYYY-MM-DD）

    relationship: 'spouse'         // 配偶者
                | 'child'          // 子供
                | 'parent'         // 父母
                | 'other';         // その他

    dependencyStartDate: string;    // 扶養開始日（YYYY-MM-DD）
    dependencyEndDate: string | null; // 扶養終了日（YYYY-MM-DD）

    status: 'active' | 'ended';     // 扶養状態

    gender?: 'male' | 'female';     // 性別
    myNumber?: string;              // 個人番号
    address?: string;               // 住所
    occupation?: string;            // 職業
    income?: number | null;         // 収入
    isDisabled?: boolean;           // 障害者に該当

    memo: string;                   // メモ
};

export type DependentInput = {
    lastName: string;
    firstName: string;
    birthDate: string;
    relationship: Dependent['relationship'];
    dependencyStartDate: string;
    dependencyEndDate: string | null;
    status: Dependent['status'];
    gender?: 'male' | 'female';
    myNumber?: string;
    address?: string;
    occupation?: string;
    income?: number | null;
    isDisabled?: boolean;
    memo?: string;
};



export type Employee = {
    id: string;                     // 従業員ID

    // 会社・事業所紐づけ
    companyId: string;              // 会社ID
    officeId: string;               // 事業所ID

    // 基本情報
    employeeNumber: string;         // 社員番号
    /** 被保険者整理番号（事業所内連番。手続き表示・出力用） */
    insuredPersonNumber: string;
    lastName: string;               // 姓
    firstName: string;              // 名
    lastNameKana: string;           // 姓（カナ）
    firstNameKana: string;          // 名（カナ）
    email: string;                  // メールアドレス（ユーザー招待・ログイン用）
    myNumber: string;               // マイナンバー
    gender: 'male' | 'female' | null;  // 性別（未設定可）
    postalCode: string;             // 郵便番号
    prefecture: string;             // 都道府県
    city: string;                   // 市区町村
    streetAddress: string;          // 丁目番地
    buildingName: string;           // 建物名・号室
    phoneNumber: string;            // 電話番号
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

export function createEmptyEmployeeInput(
    overrides: Partial<EmployeeInput> = {},
): EmployeeInput {
    return {
        companyId: '',
        officeId: '',
        employeeNumber: '',
        insuredPersonNumber: '',
        lastName: '',
        firstName: '',
        lastNameKana: '',
        firstNameKana: '',
        email: '',
        myNumber: '',
        gender: null,
        postalCode: '',
        prefecture: '',
        city: '',
        streetAddress: '',
        buildingName: '',
        phoneNumber: '',
        birthDate: '',
        joinedDate: '',
        employmentType: null,
        department: '',
        position: '',
        status: 'active',
        retiredDate: null,
        ...overrides,
    };
}

export function toEmployeeInput(
    employee: Employee,
    overrides: Partial<EmployeeInput> = {},
): EmployeeInput {
    return {
        companyId: employee.companyId,
        officeId: employee.officeId,
        employeeNumber: employee.employeeNumber,
        insuredPersonNumber: employee.insuredPersonNumber,
        lastName: employee.lastName,
        firstName: employee.firstName,
        lastNameKana: employee.lastNameKana,
        firstNameKana: employee.firstNameKana,
        email: employee.email,
        myNumber: employee.myNumber,
        gender: employee.gender,
        postalCode: employee.postalCode,
        prefecture: employee.prefecture,
        city: employee.city,
        streetAddress: employee.streetAddress,
        buildingName: employee.buildingName,
        phoneNumber: employee.phoneNumber,
        birthDate: employee.birthDate,
        joinedDate: employee.joinedDate,
        employmentType: employee.employmentType,
        department: employee.department,
        position: employee.position,
        status: employee.status,
        retiredDate: employee.retiredDate,
        ...overrides,
    };
}

