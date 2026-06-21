import { Timestamp } from 'firebase/firestore';

import { FixedWageFieldKey } from '../utils/fixed-wage-change.util';

/** 給与条件（Firestore: salaryConditions） */
export type SalaryCondition = {
    id: string;
    companyId: string;
    employeeId: string;
    /** 適用開始月（YYYY-MM） */
    effectiveStartMonth: string;
    basicSalary: number;
    commutingAllowance: number;
    positionAllowance: number;
    housingAllowance: number;
    fixedOvertimePay: number;
    otherFixedAllowance: number;
    /** 固定的賃金合計（保存時に算定） */
    fixedWageTotal: number;
    /** 前回給与条件から合計が変わった場合 true（随時改定候補） */
    triggersRevision: boolean;
    note: string;
    changeReason: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
};

export type SalaryConditionInput = Omit<
    SalaryCondition,
    'id' | 'fixedWageTotal' | 'triggersRevision' | 'createdAt' | 'updatedAt'
>;

export type SalaryConditionFormValue = {
    effectiveStartMonth: string;
    basicSalary: number | '';
    commutingAllowance: number | '';
    positionAllowance: number | '';
    housingAllowance: number | '';
    fixedOvertimePay: number | '';
    otherFixedAllowance: number | '';
    note: string;
    changeReason: string;
};

export type SalaryConditionPeriod = {
    condition: SalaryCondition;
    /** 表示用終了月（YYYY-MM）。継続中は null */
    displayEndMonth: string | null;
    displayLabel: string;
};

export type SalaryConditionFixedWageFields = Pick<
    SalaryCondition,
    FixedWageFieldKey
>;
