import { Office } from '../models/office.model';
import { JAPANESE_PREFECTURES } from '../../../shared/constants/japanese-prefectures';

export function extractPrefectureFromAddress(address: string): string | null {
    const normalized = address.trim();
    if (!normalized) return null;

    for (const prefecture of JAPANESE_PREFECTURES) {
        if (normalized.includes(prefecture)) {
            return prefecture;
        }
    }

    return null;
}

export function resolveOfficePrefecture(
    office: Pick<Office, 'prefecture' | 'city' | 'streetAddress'> | null | undefined,
    fallbackPrefecture?: string | null,
): string | null {
    const explicit = office?.prefecture?.trim();
    if (explicit) return explicit;

    const fallback = fallbackPrefecture?.trim();
    if (fallback) return fallback;

    const addressText = [office?.prefecture, office?.city, office?.streetAddress]
        .filter((part) => part?.trim())
        .join('');

    return extractPrefectureFromAddress(addressText);
}
