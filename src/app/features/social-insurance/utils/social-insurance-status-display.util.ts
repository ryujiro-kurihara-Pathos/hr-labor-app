import { insuranceJoinStatus, SocialInsuranceStatus } from '../models/social-insurance-status.model';

export type InsuranceJoinKind = 'health' | 'pension' | 'care';

export function insuranceJoinStatusLabel(status: insuranceJoinStatus): string {
    return status === 'active' ? '対象' : status === 'inactive' ? '対象外' : '未設定';
}

/** 資格取得手続き完了後、かつ各保険の資格取得日が登録済みの場合のみ加入中 */
export function isInsuranceEnrolled(
    joinStatus: insuranceJoinStatus,
    kind: InsuranceJoinKind,
    socialStatus: SocialInsuranceStatus | null,
    qualificationSubmitted: boolean,
): boolean {
    if (joinStatus !== 'active') return false;
    if (!qualificationSubmitted || !socialStatus) return false;

    switch (kind) {
        case 'health':
            return Boolean(socialStatus.healthInsuranceStartDate?.trim());
        case 'pension':
            return Boolean(socialStatus.pensionInsuranceStartDate?.trim());
        case 'care':
            return Boolean(socialStatus.careInsuranceStartDate?.trim());
    }
}

/** 加入状況一覧ページ用の表示ラベル */
export function insuranceJoinStatusListLabel(
    joinStatus: insuranceJoinStatus,
    kind: InsuranceJoinKind,
    socialStatus: SocialInsuranceStatus | null,
    qualificationSubmitted: boolean,
): string {
    if (isInsuranceEnrolled(joinStatus, kind, socialStatus, qualificationSubmitted)) {
        return '加入中';
    }
    return insuranceJoinStatusLabel(joinStatus);
}

export function isUnsetInsuranceStatus(status: SocialInsuranceStatus | null): boolean {
    if (!status) return true;
    return (
        status.healthInsuranceStatus === 'unknown' ||
        status.pensionInsuranceStatus === 'unknown'
    );
}

export function formatInsuranceDate(value: string | null | undefined): string {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return '—';
    const [y, m, d] = trimmed.split('-');
    if (!y || !m || !d) return trimmed;
    return `${y}/${m}/${d}`;
}

export function memoPreview(memo: string | null | undefined, maxLength = 24): string {
    const trimmed = memo?.trim() ?? '';
    if (!trimmed) return '—';
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}
