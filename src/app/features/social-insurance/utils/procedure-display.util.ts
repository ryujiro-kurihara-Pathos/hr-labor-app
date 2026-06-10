import { Timestamp } from 'firebase/firestore';

import {
    LOSS_REASON_LABELS,
    LossReason,
    ProcedureStatus,
    ProcedureType,
} from '../models/procedures.model';

export function procedureStatusLabel(status: ProcedureStatus): string {
    const labels: Record<ProcedureStatus, string> = {
        notStarted: '未対応',
        inProgress: '対応中',
        completed: '完了',
    };
    return labels[status];
}

export function procedureTypeLabel(type: ProcedureType): string {
    const labels: Record<ProcedureType, string> = {
        qualification: '資格取得',
        loss: '資格喪失',
        dependentChange: '扶養変更',
        regularDecision: '算定基礎届',
        revision: '月額変更届',
        bonusPayment: '賞与支払届',
        premiumPayment: '保険料納付',
    };
    return labels[type];
}

export function genderLabel(gender: string | null | undefined): string {
    if (gender === null || gender === undefined) return '—';
    return gender === 'female' ? '女性' : '男性';
}

export function dateLabel(date: string | null | undefined): string {
    if (date === null || date === undefined || date === '') return '—';
    const [y, m, d] = date.split('-');
    if (!y || !m || !d) return '—';
    return `${y}/${m}/${d}`;
}

export function timestampDateLabel(timestamp: Timestamp | null | undefined): string {
    if (!timestamp) return '—';
    const date = timestamp.toDate();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
}

export function lossReasonLabel(reason: LossReason | null | undefined): string {
    if (!reason) return '—';
    return LOSS_REASON_LABELS[reason];
}

/** 健康保険・厚生年金の喪失日、手続き発生日の順で表示用の喪失日を解決する */
export function resolveLossDate(
    healthInsuranceEndDate: string | null | undefined,
    pensionInsuranceEndDate: string | null | undefined,
    occurredDate: string | null | undefined,
): string | null {
    return healthInsuranceEndDate || pensionInsuranceEndDate || occurredDate || null;
}
