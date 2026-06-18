import { Office } from '../models/office.model';

export function normalizeOfficeName(name: string): string {
    return name.trim();
}

export function isDuplicateOfficeName(
    offices: Pick<Office, 'id' | 'name'>[],
    name: string,
    excludeOfficeId?: string,
): boolean {
    const normalized = normalizeOfficeName(name);
    if (!normalized) return false;

    return offices.some((office) => {
        if (excludeOfficeId && office.id === excludeOfficeId) return false;
        return normalizeOfficeName(office.name) === normalized;
    });
}
