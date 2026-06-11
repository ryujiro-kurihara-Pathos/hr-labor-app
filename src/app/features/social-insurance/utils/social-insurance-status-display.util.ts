import { insuranceJoinStatus, SocialInsuranceStatus } from '../models/social-insurance-status.model';

export function insuranceJoinStatusLabel(status: insuranceJoinStatus): string {
    return status === 'active' ? '対象' : status === 'inactive' ? '対象外' : '未設定';
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
