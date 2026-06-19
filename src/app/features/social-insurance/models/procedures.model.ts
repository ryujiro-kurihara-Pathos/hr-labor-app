import { Timestamp } from 'firebase/firestore';

export type ProcedureType =
    | 'qualification'      // 資格取得手続き
    | 'loss'               // 資格喪失手続き
    | 'dependentChange'    // 扶養変更手続き
    | 'regularDecision'    // 算定基礎届
    | 'revision'           // 月額変更届
    | 'bonusPayment'       // 賞与支払届
    | 'premiumPayment';    // 保険料納付

export type ProcedureStatus =
    | 'notStarted'         // 未対応
    | 'inProgress'         // 対応中
    | 'completed';         // 完了

/** 被保険者資格喪失届の資格喪失理由 */
export type LossReason =
    | 'retirement'         // 退職
    | 'death'              // 死亡
    | 'age70'              // 70歳到達
    | 'age75'              // 75歳到達
    | 'other';             // その他

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
    retirement: '退職',
    death: '死亡',
    age70: '70歳到達',
    age75: '75歳到達',
    other: 'その他',
};

/** 資格取得届の表示用フィールド（完了時に procedures へ直接保存） */
export type QualificationProcedureData = {
    officeSymbol: string;
    officeNumber: string;
    companyName: string;
    officeName: string;
    officeAddress: string;
    representativeName: string;
    phoneNumber: string;
    employeeLastName: string;
    employeeFirstName: string;
    employeeLastNameKana: string;
    employeeFirstNameKana: string;
    birthDate: string;
    myNumber: string;
    insuredPersonNumber: string;
    employeeAddress: string;
    qualificationDate: string;
    rewardTargetYearMonth: string | null;
    rewardCashAmount: number | null;
    rewardInKindAmount: number | null;
    rewardTotalAmount: number | null;
    rewardIsMidMonthJoin: boolean;
    hasDependents: boolean;
};

/** 扶養追加の理由 */
export type DependentAddReason =
    | 'birth'                      // 出生
    | 'marriage'                   // 結婚
    | 'jobLoss'                    // 離職
    | 'incomeDecrease'             // 収入減少
    | 'employmentTypeChange'       // 雇用形態変更
    | 'unemploymentBenefitEnd'     // 失業給付終了
    | 'dependentProviderChange'    // 扶養者変更
    | 'other';                     // その他

export const DEPENDENT_ADD_REASON_LABELS: Record<DependentAddReason, string> = {
    birth: '出生',
    marriage: '結婚',
    jobLoss: '離職',
    incomeDecrease: '収入減少',
    employmentTypeChange: '雇用形態変更',
    unemploymentBenefitEnd: '失業給付終了',
    dependentProviderChange: '扶養者変更',
    other: 'その他',
};

/** 扶養削除の理由 */
export type DependentDeleteReason =
    | 'death'                    // 死亡
    | 'employment'               // 就職
    | 'incomeIncrease'           // 収入増加
    | 'age75'                    // 75歳到達
    | 'disabilityCertification'  // 障害認定
    | 'other';                   // その他

export const DEPENDENT_DELETE_REASON_LABELS: Record<DependentDeleteReason, string> = {
    death: '死亡',
    employment: '就職',
    incomeIncrease: '収入増加',
    age75: '75歳到達',
    disabilityCertification: '障害認定',
    other: 'その他',
};

/** 扶養変更届の表示・保存用フィールド */
export type DependentProcedureData = {
    dependentId: string | null;
    dependentLastName: string;
    dependentFirstName: string;
    dependentBirthDate: string;
    dependentGender: string;
    dependentRelationship: string;
    dependentMyNumber: string;
    dependentAddress: string;
    dependentOccupation: string;
    dependentIncome: number | null;
    dependentIsDisabled: boolean;
    dependencyStartDate: string;
    dependentAddReason: DependentAddReason | '';
    dependentAddReasonNote: string;
    dependencyEndDate: string;
    dependentDeleteReason: DependentDeleteReason | '';
};

export const EMPTY_DEPENDENT_PROCEDURE_DATA: DependentProcedureData = {
    dependentId: null,
    dependentLastName: '',
    dependentFirstName: '',
    dependentBirthDate: '',
    dependentGender: '',
    dependentRelationship: '',
    dependentMyNumber: '',
    dependentAddress: '',
    dependentOccupation: '',
    dependentIncome: null,
    dependentIsDisabled: false,
    dependencyStartDate: '',
    dependentAddReason: '',
    dependentAddReasonNote: '',
    dependencyEndDate: '',
    dependentDeleteReason: '',
};

export const EMPTY_QUALIFICATION_PROCEDURE_DATA: QualificationProcedureData = {
    officeSymbol: '',
    officeNumber: '',
    companyName: '',
    officeName: '',
    officeAddress: '',
    representativeName: '',
    phoneNumber: '',
    employeeLastName: '',
    employeeFirstName: '',
    employeeLastNameKana: '',
    employeeFirstNameKana: '',
    birthDate: '',
    myNumber: '',
    insuredPersonNumber: '',
    employeeAddress: '',
    qualificationDate: '',
    rewardTargetYearMonth: null,
    rewardCashAmount: null,
    rewardInKindAmount: null,
    rewardTotalAmount: null,
    rewardIsMidMonthJoin: false,
    hasDependents: false,
};

type ProcedureCore = {
    id: string;                         // FirestoreドキュメントID

    companyId: string;                  // 会社ID
    officeId: string;                   // 事業所ID

    /**
     * 従業員に紐づく手続きの場合は employeeId を入れる。
     * 算定基礎届や保険料納付など、会社全体・年月単位の手続きは null。
     */
    employeeId: string | null;

    procedureType: ProcedureType;       // 手続き種別
    status: ProcedureStatus;            // 対応状況

    occurredDate: string;               // 発生日 例: 入社日、退職日、賞与支給日
    dueDate: string;                    // 対応期限
    completedDate: string | null;       // 完了日
    submittedDate: string | null;       // 提出日

    targetYearMonth: string | null;     // 対象年月 例: '2026-06'

    memo: string;                       // メモ

    /** 資格喪失手続き（loss）のときのみ使用 */
    lossReason: LossReason | null;

    /** 扶養変更手続き（dependentChange）のときのみ使用 */
    dependentChanges: 'add' | 'delete' | 'change' | null;

    createdAt: Timestamp;
    updatedAt: Timestamp;
};

export type Procedure = ProcedureCore & QualificationProcedureData & DependentProcedureData;

export type ProcedureInput = Omit<ProcedureCore, 'id' | 'createdAt' | 'updatedAt'> &
    Partial<QualificationProcedureData & DependentProcedureData>;
