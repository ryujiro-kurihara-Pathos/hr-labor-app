import { Timestamp } from 'firebase/firestore';
import { HealthInsuranceType } from '../../company/models/office.model';

export type StandardMonthlyRewardTableType = 'healthInsurance' | 'pensionInsurance';

// 標準報酬月額表の行
export type StandardMonthlyRewardTableRow = {
    grade: number;                             // 等級
    minInclusive: number;                      // 報酬月額以上
    maxExclusive: number;                      // 報酬月額未満
    standardMonthlyAmount: number;             // 標準報酬月額
};

// 標準報酬月額表
export type StandardMonthlyRewardTable = {
    id: string;                                      // 標準報酬月額表ID
    type: StandardMonthlyRewardTableType;            // 標準報酬月額表の種類
    effectiveFrom: string;                           // 有効開始日
    effectiveTo: string | null;                      // 有効終了日
    healthInsuranceType: HealthInsuranceType | null; // 健康保険の種類
    rows: StandardMonthlyRewardTableRow[];           // 標準報酬月額表の行
    createdAt?: Timestamp;                           // 作成日時
    updatedAt?: Timestamp;                           // 更新日時
};

// 等級/標準報酬月額の検索結果
export type GradeLookupResult = {
    grade: number;                                 // 等級
    standardMonthlyAmount: number;                 // 標準報酬月額
};
