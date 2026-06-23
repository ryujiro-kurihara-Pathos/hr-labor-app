import { BonusReward } from '../../bonus/models/bonus-reward.model';
import { EmploymentType } from '../../employee/models/employee.models';
import { SalaryCondition } from '../../insurance/models/salary-condition.model';
import { StandardMonthlyReward, StandardMonthlyRewardInput } from '../../insurance/models/standard-monthly-reward.model';
import { effectiveMonthlyRewardTotal } from '../../insurance/utils/effective-monthly-reward.util';
import { buildJoinMonthRewardFromSalaryCondition } from '../../insurance/utils/join-month-expected-reward.util';
import { shouldProrateMonthlyRewardByPaymentBaseDays } from '../../insurance/utils/monthly-reward-proration.util';
import { lookupQualificationInitialReward, resolveQualificationRewardPayYearMonth } from '../../insurance/utils/reward-pay-month.util';
import { yearMonthFromDateString } from '../../insurance/utils/reward-target-month.util';
import { monthlyRewardTotal } from '../../insurance/utils/revision-determination.util';
import { resolveInitialSalaryConditionForQualification } from '../../insurance/utils/salary-condition.util';
import { PayrollPaymentMonthOffset } from '../../insurance/utils/standard-remuneration-determination.util';

export type QualificationMonthlyReward = {
    targetYearMonth: string;
    cashAmount: number;
    inKindAmount: number;
    totalAmount: number;
    isMidMonthJoin: boolean;
    /** パート・アルバイトは入力した報酬月額をそのまま使用 */
    usesDirectMonthlyRewardEntry: boolean;
    /** 見込み報酬（給与条件）を参照している */
    fromExpectedSalaryCondition?: boolean;
};

export type QualificationJoinMonthRewardSource = {
    reward: StandardMonthlyReward | null;
    fromExpectedSalaryCondition: boolean;
};

function joinMonthRewardFromExpectedInput(input: StandardMonthlyRewardInput): StandardMonthlyReward {
    const { monthlyRewardAmount, ...rest } = input;
    const reward: StandardMonthlyReward = {
        id: `${input.employeeId}_${input.targetYearMonth}`,
        ...rest,
        monthlyReward: monthlyRewardAmount,
        status: 'confirmed',
        createdAt: {} as StandardMonthlyReward['createdAt'],
        updatedAt: {} as StandardMonthlyReward['updatedAt'],
    };
    if (reward.monthlyReward == null) {
        reward.monthlyReward = monthlyRewardTotal(reward);
    }
    return reward;
}

/** 資格取得届に使う入社時の報酬レコードを取得（翌月払いの支給年月キーにも対応） */
export function lookupQualificationJoinMonthReward(
    joinedDate: string,
    rewardsByYearMonth: Record<string, StandardMonthlyReward>,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): StandardMonthlyReward | null {
    const qualificationYearMonth = yearMonthFromDateString(joinedDate);
    if (!qualificationYearMonth) return null;
    return lookupQualificationInitialReward(
        rewardsByYearMonth,
        qualificationYearMonth,
        payrollPaymentMonthOffset,
    );
}

/** 入社月の報酬を給与条件（見込み報酬）優先で解決 */
export function resolveQualificationJoinMonthReward(params: {
    joinedDate: string;
    companyId: string;
    employeeId: string;
    employmentType: EmploymentType;
    salaryConditions: SalaryCondition[];
    rewardsByYearMonth: Record<string, StandardMonthlyReward>;
    payrollPaymentMonthOffset?: PayrollPaymentMonthOffset;
}): QualificationJoinMonthRewardSource {
    const joinYm = yearMonthFromDateString(params.joinedDate);
    if (!joinYm) {
        return { reward: null, fromExpectedSalaryCondition: false };
    }

    const condition = resolveInitialSalaryConditionForQualification(
        params.salaryConditions,
        params.joinedDate,
        params.payrollPaymentMonthOffset ?? 1,
    );
    if (condition) {
        const input = buildJoinMonthRewardFromSalaryCondition({
            companyId: params.companyId,
            employeeId: params.employeeId,
            joinedDate: params.joinedDate,
            employmentType: params.employmentType,
            condition,
        });
        if (input) {
            return {
                reward: joinMonthRewardFromExpectedInput(input),
                fromExpectedSalaryCondition: true,
            };
        }
    }

    const reward = lookupQualificationJoinMonthReward(
        params.joinedDate,
        params.rewardsByYearMonth,
        params.payrollPaymentMonthOffset ?? 1,
    );
    return { reward, fromExpectedSalaryCondition: false };
}

/** 報酬入力画面へのリンク用支給年月 */
export function resolveQualificationRewardInputYearMonth(
    joinedDate: string,
    payrollPaymentMonthOffset: PayrollPaymentMonthOffset = 1,
): string | null {
    const qualificationYearMonth = yearMonthFromDateString(joinedDate);
    if (!qualificationYearMonth) return null;
    return resolveQualificationRewardPayYearMonth(qualificationYearMonth, payrollPaymentMonthOffset);
}

/** 入社月の報酬月額 */
export function resolveQualificationMonthlyReward(
    joinedDate: string,
    reward: StandardMonthlyReward | null,
    allBonuses: BonusReward[] = [],
    employmentType: EmploymentType = null,
    fromExpectedSalaryCondition = false,
): QualificationMonthlyReward | null {
    const targetYearMonth = yearMonthFromDateString(joinedDate);
    if (!targetYearMonth || !reward) return null;

    const totalAmount = effectiveMonthlyRewardTotal(reward, targetYearMonth, allBonuses);
    if (totalAmount <= 0) return null;

    const day = Number(joinedDate.split('-')[2]);
    const isMidMonthJoin =
        shouldProrateMonthlyRewardByPaymentBaseDays(employmentType) &&
        Number.isFinite(day) &&
        day > 1;
    const usesDirectMonthlyRewardEntry = !shouldProrateMonthlyRewardByPaymentBaseDays(employmentType);

    return {
        targetYearMonth,
        cashAmount: totalAmount,
        inKindAmount: 0,
        totalAmount,
        isMidMonthJoin,
        usesDirectMonthlyRewardEntry,
        fromExpectedSalaryCondition,
    };
}

export function formatYen(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '—';
    return `${amount.toLocaleString()} 円`;
}
