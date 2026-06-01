import { Timestamp } from 'firebase/firestore';

export type StandardMonthlyReward = {
    id: string;                                      // 標準報酬月額ID

    // 従業員紐づけ
    employeeId: string;                              // 従業員ID

    // 対象年月
    targetYearMonth: string;                         // 対象年月 例: '2026-04'

    // 報酬情報
    basicSalary: number;                             // 基本給
    commutingAllowance: number;                      // 通勤手当
    monthlyAllowance: number;                        // 毎月支給される手当
    positionAllowance: number;                       // 役職手当
    housingAllowance: number;                        // 住宅手当
    fixedOvertimePay: number;                        // 見込み残業代

    // 報酬月額
    monthlyReward: number;                           // 報酬月額

    // 健康保険
    healthInsuranceGrade: number;                    // 健康保険の等級
    healthInsuranceStandardMonthlyAmount: number;    // 健康保険の標準報酬月額

    // 厚生年金
    pensionInsuranceGrade: number;                   // 厚生年金の等級
    pensionInsuranceStandardMonthlyAmount: number;   // 厚生年金の標準報酬月額

    // 作成・更新日時
    createdAt: Timestamp;                            // 作成日時
    updatedAt: Timestamp;                            // 更新日時
};

export type StandardMonthlyRewardInput = Omit<
    StandardMonthlyReward,
    | 'id'
    | 'monthlyReward'
    | 'healthInsuranceGrade'
    | 'healthInsuranceStandardMonthlyAmount'
    | 'pensionInsuranceGrade'
    | 'pensionInsuranceStandardMonthlyAmount'
    | 'createdAt'
    | 'updatedAt'
>;

export type RewardForm = {
    targetYearMonth: string;                         // 対象年月 例: '2026-04'

    basicSalary: number;                             // 基本給
    commutingAllowance: number;                      // 通勤手当
    monthlyAllowance: number;                        // 毎月支給される手当
    positionAllowance: number;                       // 役職手当
    housingAllowance: number;                        // 住宅手当
    fixedOvertimePay: number;                        // 見込み残業代
};