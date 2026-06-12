import { Timestamp } from 'firebase/firestore';

/**
 * 月次報酬レコード（StandardMonthlyReward）と
 * 標準報酬月額の決定（StandardMonthlyRewardDecision）の型定義。
 *
 * - 月次レコード: 各月の給与内訳・報酬月額の入力・保存用
 * - 決定: 資格取得時・定時・随時で適用する等級と適用期間（将来永続化用）
 */

/** 月次報酬の保存状態（DB 未保存時は default） */
export type StandardMonthlyRewardStatus = 'default' | 'draft' | 'confirmed';

/** 報酬月額（またはその平均）から等級表で求めた健康保険・厚生年金の標準報酬月額 */
export type InsuranceStandardRemuneration = {
    healthInsuranceGrade: number;                    // 健康保険の等級
    healthInsuranceStandardMonthlyAmount: number;    // 健康保険の標準報酬月額
    pensionInsuranceGrade: number;                   // 厚生年金の等級
    pensionInsuranceStandardMonthlyAmount: number;   // 厚生年金の標準報酬月額
};

/** 月次報酬レコード（Firestore: standardMonthlyRewards） */
export type StandardMonthlyReward = {
    id: string;                                      // ドキュメントID

    // 会社・従業員紐づけ
    companyId: string;                               // 会社ID
    employeeId: string;                              // 従業員ID

    // 対象年月
    targetYearMonth: string;                         // 対象年月（YYYY-MM）例: '2026-04'

    // 固定的賃金
    basicSalary: number;                             // 基本給
    commutingAllowance: number;                      // 通勤手当
    positionAllowance: number;                       // 役職手当
    housingAllowance: number;                        // 住宅手当
    fixedOvertimePay: number;                        // 見込み残業代
    otherFixedAllowance: number;                     // その他固定手当

    // 変動的賃金
    overtimePay: number;                             // 残業代
    holidayPay: number;                              // 休日手当
    nightPay: number;                                // 深夜手当
    commissionPay: number;                           // インセンティブ
    otherVariablePay: number;                        // その他変動手当

  /** 前月と比較して固定的賃金に変更があったか（月額変更改定の判定材料） */
    fixedWageChanged?: boolean;
    /** 前月から変更のあった項目名 */
    changedFixedWageFields?: string[];

    /** 保存状態（未設定の既存データは確定として扱う） */
    status?: StandardMonthlyRewardStatus;

    createdAt: Timestamp;                            // 作成日時
    updatedAt: Timestamp;                            // 更新日時
} & InsuranceStandardRemuneration;

export type StandardMonthlyRewardInput = Omit<
    StandardMonthlyReward,
    | 'id'
    | 'monthlyReward'
    | 'createdAt'
    | 'updatedAt'
>;

export type RewardFormFieldValue = number | '';

export type RewardForm = {
    targetYearMonth: string;                         // 対象年月 例: '2026-04'

    basicSalary: RewardFormFieldValue;                 // 基本給
    commutingAllowance: RewardFormFieldValue;          // 通勤手当
    positionAllowance: RewardFormFieldValue;           // 役職手当
    housingAllowance: RewardFormFieldValue;            // 住宅手当
    fixedOvertimePay: RewardFormFieldValue;            // 見込み残業代
    otherFixedAllowance: RewardFormFieldValue;         // その他固定手当
    overtimePay: RewardFormFieldValue;                 // 残業代
    holidayPay: RewardFormFieldValue;                  // 休日手当
    nightPay: RewardFormFieldValue;                    // 深夜手当
    commissionPay: RewardFormFieldValue;               // インセンティブ
    otherVariablePay: RewardFormFieldValue;            // その他変動手当
};

export type StandardMonthlyRewardDecisionType =
    | 'initial'    // 資格取得時決定
    | 'regular'    // 定時決定
    | 'revision';  // 随時決定

/** 標準報酬月額の決定（将来永続化用） */
export type StandardMonthlyRewardDecision = {
    id: string;

    // 会社・従業員紐づけ
    companyId: string;                               // 会社ID
    employeeId: string;                              // 従業員ID

    decisionType: StandardMonthlyRewardDecisionType; // 決定種別
    effectiveFrom: string;                           // 適用開始（YYYY-MM）
    effectiveTo: string | null;                      // 適用終了（YYYY-MM）、継続中は null

    /** 等級算定に使った報酬月額（定時は4〜6月平均、資格取得時は取得月の報酬月額） */
    basisMonthlyReward: number;

    /** 定時決定時の算定対象月（例: ['2025-04','2025-05','2025-06']） */
    calculationMonths?: string[];

    createdAt: Timestamp;                            // 作成日時
    updatedAt: Timestamp;                            // 更新日時
} & InsuranceStandardRemuneration;

export type StandardMonthlyRewardDecisionInput = Omit<
    StandardMonthlyRewardDecision,
    'id' | 'createdAt' | 'updatedAt'
>;
