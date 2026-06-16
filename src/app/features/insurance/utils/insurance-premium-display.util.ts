import { insuranceJoinStatus } from '../../social-insurance/models/social-insurance-status.model';

export type InsurancePremiumAmountDisplay =
    | { kind: 'amount'; amount: number }
    | { kind: 'not_subject'; label: string }
    | { kind: 'undetermined'; message: string };

const NOT_SUBJECT_LABEL = '加入対象でないため0円';

export function buildEnrollmentUndeterminedMessage(
    healthStatus: insuranceJoinStatus,
    pensionStatus: insuranceJoinStatus,
): string | null {
    const unset: string[] = [];
    if (healthStatus === 'unknown') unset.push('健康保険');
    if (pensionStatus === 'unknown') unset.push('厚生年金');
    if (unset.length === 0) return null;
    return `${unset.join('・')}の加入対象が未設定のため、保険料を判定できません。社会保険の加入状況を入力してください。`;
}

export function resolveInsurancePremiumAmountDisplay(options: {
    joinStatus: insuranceJoinStatus;
    isPremiumMonth: boolean;
    premium: number | null;
    enrollmentUndetermined?: boolean;
    liabilityRewardConfirmed?: boolean;
}): InsurancePremiumAmountDisplay {
    const {
        joinStatus,
        isPremiumMonth,
        premium,
        enrollmentUndetermined = false,
        liabilityRewardConfirmed = true,
    } = options;

    if (enrollmentUndetermined || joinStatus === 'unknown') {
        return {
            kind: 'undetermined',
            message: '加入対象が未設定のため判定できません',
        };
    }

    if (premium !== null && isPremiumMonth) {
        return { kind: 'amount', amount: premium };
    }

    if (joinStatus === 'inactive' || !isPremiumMonth) {
        return { kind: 'not_subject', label: NOT_SUBJECT_LABEL };
    }

    if (!liabilityRewardConfirmed) {
        return {
            kind: 'undetermined',
            message: '根拠月の報酬が未確定のため判定できません',
        };
    }

    return {
        kind: 'undetermined',
        message: '算定に必要な情報が不足しているため判定できません',
    };
}

export function isDefinitivelyNotEnrolledInSocialInsurance(
    healthStatus: insuranceJoinStatus,
    pensionStatus: insuranceJoinStatus,
): boolean {
    return healthStatus === 'inactive' && pensionStatus === 'inactive';
}

export { NOT_SUBJECT_LABEL };

export function premiumDisplayAmountValue(display: InsurancePremiumAmountDisplay): number | null {
    return display.kind === 'amount' ? display.amount : null;
}

export function premiumDisplayShowsZero(display: InsurancePremiumAmountDisplay): boolean {
    return display.kind === 'not_subject';
}

export function premiumDisplayNote(display: InsurancePremiumAmountDisplay): string | null {
    if (display.kind === 'not_subject') return display.label;
    if (display.kind === 'undetermined') return display.message;
    return null;
}

export function premiumDisplayIsAmount(display: InsurancePremiumAmountDisplay): boolean {
    return display.kind === 'amount';
}
