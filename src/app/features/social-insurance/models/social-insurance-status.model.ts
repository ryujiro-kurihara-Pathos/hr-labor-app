import { Timestamp } from 'firebase/firestore';

export type insuranceJoinStatus = 'active' | 'inactive' | 'unknown';

export type SocialInsuranceStatus = {
    id: string;                                    // ドキュメントID

    // 従業員紐づけ
    employeeId: string;                            // 従業員ID

    // 会社状況
    healthInsuranceStatus: insuranceJoinStatus;   // 健康保険状況
    pensionInsuranceStatus: insuranceJoinStatus;  // 厚生年金状況
    careInsuranceStatus: insuranceJoinStatus;     // 介護保険状況

    // 健康保険
    healthInsuranceStartDate: string | null;      // 健康保険の資格取得日
    healthInsuranceEndDate: string | null;        // 健康保険の資格喪失日

    // 厚生年金
    pensionInsuranceStartDate: string | null;     // 厚生年金の資格取得日
    pensionInsuranceEndDate: string | null;       // 厚生年金の資格喪失日

    // 介護保険
    careInsuranceStartDate: string | null;        // 介護保険の対象開始日
    careInsuranceEndDate: string | null;          // 介護保険の対象終了日

    // 作成・更新日時
    createdAt: Timestamp;                         // 作成日時
    updatedAt: Timestamp;                         // 更新日時
}

export type SocialInsuranceStatusInput = Omit<SocialInsuranceStatus, 'id' | 'createdAt' | 'updatedAt'>;