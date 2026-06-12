import { Timestamp } from 'firebase/firestore';

import { Employee } from '../../employee/models/employee.models';
import { lossDateFromRetirementDate } from './insurance-premium-period.util';
import {
    LOSS_REASON_LABELS,
    LossReason,
    Procedure,
    ProcedureStatus,
    ProcedureType,
} from '../models/procedures.model';

export type ProcedureTypeTone = 'blue' | 'rose' | 'violet' | 'amber' | 'orange' | 'green' | 'slate';

export type ProcedureTypeMeta = {
    icon: string;
    tone: ProcedureTypeTone;
    shortLabel: string;
};

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
        qualification: '被保険者資格取得届',
        loss: '資格喪失届',
        dependentChange: '被扶養者異動届',
        regularDecision: '算定基礎届',
        revision: '月額変更届',
        bonusPayment: '賞与支払届',
        premiumPayment: '保険料納付',
    };
    return labels[type];
}

export function procedureTypeMeta(type: ProcedureType): ProcedureTypeMeta {
    const meta: Record<ProcedureType, ProcedureTypeMeta> = {
        qualification: { icon: '取', tone: 'blue', shortLabel: '資格取得' },
        loss: { icon: '喪', tone: 'rose', shortLabel: '資格喪失' },
        dependentChange: { icon: '扶', tone: 'violet', shortLabel: '扶養変更' },
        regularDecision: { icon: '算', tone: 'amber', shortLabel: '算定基礎' },
        revision: { icon: '改', tone: 'orange', shortLabel: '月額変更' },
        bonusPayment: { icon: '賞', tone: 'green', shortLabel: '賞与支払' },
        premiumPayment: { icon: '納', tone: 'slate', shortLabel: '保険料納付' },
    };
    return meta[type];
}

export function todayDateString(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function isProcedureOverdue(
    procedure: Pick<Procedure, 'status' | 'dueDate'>,
    today = todayDateString(),
): boolean {
    return Boolean(
        procedure.status !== 'completed' && procedure.dueDate && procedure.dueDate < today,
    );
}

export function resolveProcedureSubjectName(
    procedure: Pick<Procedure, 'employeeId' | 'employeeLastName' | 'employeeFirstName' | 'targetYearMonth' | 'procedureType'>,
    employeeNameById: Record<string, string> = {},
): string {
    if (procedure.employeeId) {
        const name = employeeNameById[procedure.employeeId];
        if (name) return name;
    }

    const savedName = `${procedure.employeeLastName ?? ''} ${procedure.employeeFirstName ?? ''}`.trim();
    if (savedName) return savedName;

    if (procedure.targetYearMonth) {
        return `対象 ${procedure.targetYearMonth}`;
    }

    if (
        procedure.procedureType === 'regularDecision' ||
        procedure.procedureType === 'premiumPayment'
    ) {
        return '会社全体';
    }

    return procedure.employeeId ? '従業員' : '—';
}

export function compareProceduresForList(a: Procedure, b: Procedure, today = todayDateString()): number {
    const aCompleted = a.status === 'completed' ? 1 : 0;
    const bCompleted = b.status === 'completed' ? 1 : 0;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;

    const aOverdue = isProcedureOverdue(a, today) ? 0 : 1;
    const bOverdue = isProcedureOverdue(b, today) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;

    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    return b.occurredDate.localeCompare(a.occurredDate);
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

export type ResolveLossDateOptions = {
    lossReason?: LossReason | null;
    /** 退職日（YYYY-MM-DD）。退職の場合は翌日を資格喪失日とする */
    retiredDate?: string | null;
};

/** 健康保険・厚生年金の喪失日、手続き発生日の順で表示用の喪失日を解決する */
export function employeeAddressLabel(employee: Employee): string {
    const parts = [
        employee.postalCode ? `〒${employee.postalCode}` : '',
        employee.prefecture,
        employee.city,
        employee.streetAddress,
        employee.buildingName,
    ].filter((part) => part.trim());
    return parts.length > 0 ? parts.join(' ') : '—';
}

export function resolveLossDate(
    healthInsuranceEndDate: string | null | undefined,
    pensionInsuranceEndDate: string | null | undefined,
    occurredDate: string | null | undefined,
    options?: ResolveLossDateOptions,
): string | null {
    if (healthInsuranceEndDate?.trim()) return healthInsuranceEndDate.trim();
    if (pensionInsuranceEndDate?.trim()) return pensionInsuranceEndDate.trim();

    if (options?.lossReason === 'retirement') {
        const retirementDate = options.retiredDate?.trim() || occurredDate?.trim();
        if (retirementDate) {
            return lossDateFromRetirementDate(retirementDate);
        }
    }

    return occurredDate?.trim() || null;
}
