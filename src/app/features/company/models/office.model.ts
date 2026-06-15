import { Timestamp } from 'firebase/firestore';

export type HealthInsuranceType = 'kyokai' | 'union'; // 本アプリは kyokai のみ利用（union は後方互換）
export type OfficeStatus = 'active' | 'disabled'; // 事業所のステータス

export type Office = {
    id: string;

    companyId: string;                              // 会社ID

    name: string;                                   // 事業所名
    postalCode: string;                             // 郵便番号
    prefecture: string;                             // 都道府県
    city: string;                                   // 市区町村
    streetAddress: string;                          // 丁目番地
    buildingName: string;                           // 建物名・号室
    phoneNumber: string;                            // 電話番号

    healthInsuranceType: HealthInsuranceType;       // 健康保険の種類
    officeSymbol: string;                           // 事業所整理記号 例: '00-ケイト'
    officeNumber: string;                           // 事業所番号（5桁）

    // 社会保険：当該事業所の通常の労働者の基準（加入要件判定用）
    regularWeeklyScheduledWorkHours: number | null; // 週の所定労働時間
    regularMonthlyScheduledWorkHours: number | null;// 月の所定労働時間
    regularWeeklyScheduledWorkDays: number | null;  // 週の所定労働日数
    regularMonthlyScheduledWorkDays: number | null; // 月の所定労働日数

    status: OfficeStatus; // 事業所のステータス

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type OfficeInput = Omit<Office, 'id' | 'createdAt' | 'updatedAt'>;

/** 事業所登録時。整理記号・事業所番号は未指定ならサービス側で自動採番する */
export type OfficeCreateInput = Omit<
    OfficeInput,
    'officeSymbol' | 'officeNumber'
> & {
    officeSymbol?: string;
    officeNumber?: string;
};

