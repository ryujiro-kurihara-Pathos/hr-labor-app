import { Timestamp } from 'firebase/firestore';

import { normalizeAuthEmail } from '../../auth/utils/email-link-auth.util';
import { Invitation } from '../models/invitation.model';

export function buildInvitationAcceptUrl(invitationId: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/invite/${invitationId}`;
}

export function buildInvitationEmailLinkUrl(invitationId: string, email: string): string {
    const params = new URLSearchParams({ email: normalizeAuthEmail(email) });
    return `${buildInvitationAcceptUrl(invitationId)}?${params.toString()}`;
}

export function isInvitationExpired(invitation: Invitation, now = new Date()): boolean {
    const expiresAt = invitation.expiresAt;
    if (!expiresAt) return true;

    const expires =
        expiresAt instanceof Timestamp ? expiresAt.toDate() : new Date(String(expiresAt));
    return expires.getTime() < now.getTime();
}

export function validateInvitationForAccept(invitation: Invitation | null): string | null {
    if (!invitation) return '招待が見つかりませんでした';
    if (invitation.status === 'accepted') return 'この招待はすでに使用されています';
    if (invitation.status === 'rejected') return 'この招待は無効です';
    if (invitation.status === 'expired' || isInvitationExpired(invitation)) {
        return '招待の有効期限が切れています';
    }
    if (invitation.status !== 'pending') return 'この招待は利用できません';
    return null;
}

export function invitationStatusLabel(status: Invitation['status']): string {
    const labels: Record<Invitation['status'], string> = {
        pending: '招待中',
        accepted: '登録済み',
        expired: '期限切れ',
        rejected: '無効',
    };
    return labels[status];
}
