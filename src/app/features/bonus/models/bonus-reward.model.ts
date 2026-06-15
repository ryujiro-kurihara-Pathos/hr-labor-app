import { Timestamp } from 'firebase/firestore';

export type BonusRewardStatus = 'draft' | 'confirmed';

export type BonusReward = {
    id: string;                         // 賞与ID

    // 会社・従業員紐づけ
    companyId: string;                  // 会社ID
    employeeId: string;                 // 従業員ID

    // 賞与情報
    paymentDate: string;                // 支給日 例: '2026-06-25'
    targetYearMonth: string;            // 支給年月 例: '2026-06'

    bonusAmount: number;                // 実際の賞与額
    standardBonusAmount: number;        // 標準賞与額 1000円未満切り捨て

    /** 保存状態（未設定の既存データは確定として扱う） */
    status?: BonusRewardStatus;

    createdAt: Timestamp;               // 作成日時
    updatedAt: Timestamp;               // 更新日時
};

export type BonusRewardInput = {
    companyId: string;
    employeeId: string;

    paymentDate: string;
    targetYearMonth: string;

    bonusAmount: number;
};

export type BonusRewardForm = {
    employeeId: string;
    paymentDate: string;
    bonusAmount: number | '';
};