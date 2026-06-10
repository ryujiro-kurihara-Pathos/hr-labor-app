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

export type Procedure = {
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

    targetYearMonth: string | null;     // 対象年月 例: '2026-06'

    memo: string;                       // メモ

    createdAt: Timestamp;
    updatedAt: Timestamp;
};

export type ProcedureInput = Omit<
    Procedure,
    'id' | 'createdAt' | 'updatedAt'
>;