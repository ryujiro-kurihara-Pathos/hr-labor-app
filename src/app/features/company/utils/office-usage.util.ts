import { Office } from '../models/office.model';

export type OfficeBusinessLinkCounts = {
    employeeCount: number;
    procedureCount: number;
};

export type OfficeDeletionCheck = OfficeBusinessLinkCounts & {
    canDelete: boolean;
    linkedReasons: string[];
};

export function filterActiveOffices(offices: Office[]): Office[] {
    return offices.filter((office) => office.status === 'active');
}

export function buildOfficeDeletionCheck(counts: OfficeBusinessLinkCounts): OfficeDeletionCheck {
    const linkedReasons: string[] = [];

    if (counts.employeeCount > 0) {
        linkedReasons.push(`従業員 ${counts.employeeCount} 名`);
    }
    if (counts.procedureCount > 0) {
        linkedReasons.push(`届出手続き ${counts.procedureCount} 件`);
    }

    return {
        ...counts,
        canDelete: linkedReasons.length === 0,
        linkedReasons,
    };
}

export function officeDeletionBlockedMessage(check: OfficeDeletionCheck): string {
    if (check.canDelete) return '';
    return `この事業所は ${check.linkedReasons.join('・')} に紐づいているため削除できません。使用しなくなる場合は無効化してください。`;
}
