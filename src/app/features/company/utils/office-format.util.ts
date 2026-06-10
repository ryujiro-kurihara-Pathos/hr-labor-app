import { Office } from '../models/office.model';

/**
 * 事業所整理記号（納入告知書）: 「数字2桁」-「英数カナ1～4桁」
 * 例: 00-ケイト
 */
const OFFICE_SYMBOL_PATTERN = /^(\d{2})-([\u30A1-\u30F3\u30FC]{1,4})$/;
const OFFICE_NUMBER_PATTERN = /^\d{5}$/;
const KYOKAI_DIGIT_SYMBOL_PATTERN = /^\d{7,8}$/;

const KATAKANA_POOL = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロ';

/** 仮事業所整理記号をランダム生成する（例: 12-ケイト） */
export function generateRandomOfficeSymbol(): string {
    const districtCode = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    const kanaLength = Math.floor(Math.random() * 2) + 3; // 3～4桁
    return `${districtCode}-${randomKatakana(kanaLength)}`;
}

/** 事業所作成時の仮事業所番号: 5桁数字 */
export function generateRandomOfficeNumber(): string {
    return String(Math.floor(Math.random() * 100000)).padStart(5, '0');
}

/** 事業所整理記号を 2桁-カタカナ1～4桁 形式に正規化する */
export function normalizeOfficeSymbol(value: string): string {
    const trimmed = value.trim().normalize('NFKC');
    if (!trimmed) return '';

    const directMatch = trimmed.match(OFFICE_SYMBOL_PATTERN);
    if (directMatch) {
        return `${directMatch[1]}-${directMatch[2]}`;
    }

    const looseMatch = trimmed.match(/^(\d{2})-?([\u30A1-\u30F3\u30FC]+)$/);
    if (looseMatch) {
        return `${looseMatch[1]}-${looseMatch[2].slice(0, 4)}`;
    }

    if (KYOKAI_DIGIT_SYMBOL_PATTERN.test(trimmed)) {
        return digitSymbolToOfficeSymbol(trimmed);
    }

    if (/^HI-\d+$/i.test(trimmed)) {
        return legacyDigitsToOfficeSymbol(trimmed.slice(3));
    }

    const legacyNumeric = trimmed.match(/^(\d{4})-(\d{5})$/);
    if (legacyNumeric) {
        return `${legacyNumeric[1].slice(2, 4)}-${digitsToKatakana(legacyNumeric[2].slice(0, 4))}`;
    }

    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length >= 2) {
        return `${digitsOnly.slice(0, 2).padStart(2, '0')}-${digitsToKatakana(digitsOnly.slice(2, 10))}`;
    }

    return trimmed;
}

export function splitOfficeSymbol(value: string | undefined | null): {
    prefix: string[];
    suffix: string[];
} {
    const normalized = normalizeOfficeSymbol(value ?? '');
    const match = normalized.match(OFFICE_SYMBOL_PATTERN);
    const prefix = (match?.[1] ?? '').padStart(2, ' ');
    const suffix = (match?.[2] ?? '').padEnd(4, ' ').slice(0, 4);

    return {
        prefix: prefix.split(''),
        suffix: suffix.split(''),
    };
}

function digitSymbolToOfficeSymbol(value: string): string {
    const digits = value.replace(/\D/g, '');
    const districtCode = digits.slice(0, 2).padStart(2, '0');
    const kanaPart = digits
        .slice(2, 10)
        .match(/.{1,2}/g)
        ?.map((pair) => twoDigitsToKatakana(pair))
        .join('')
        .slice(0, 4) || 'ケイト';

    return `${districtCode}-${kanaPart}`;
}

function twoDigitsToKatakana(pair: string): string {
    const code = Number.parseInt(pair, 10);
    if (!Number.isFinite(code) || code <= 0) return 'ア';
    return KATAKANA_POOL[(code - 1) % KATAKANA_POOL.length];
}

function randomKatakana(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += KATAKANA_POOL[Math.floor(Math.random() * KATAKANA_POOL.length)];
    }
    return result;
}

function legacyDigitsToOfficeSymbol(seed: string): string {
    const digits = seed.replace(/\D/g, '').padStart(6, '0');
    return `${digits.slice(0, 2)}-${digitsToKatakana(digits.slice(2, 6))}`;
}

function digitsToKatakana(seed: string): string {
    const digits = seed.replace(/\D/g, '');
    if (!digits) return 'ケイト';

    return digits
        .match(/.{1,2}/g)
        ?.map((pair) => twoDigitsToKatakana(pair))
        .join('')
        .slice(0, 4) || 'ケイト';
}

export function formatOfficeAddress(
    office: Pick<Office, 'postalCode' | 'prefecture' | 'city' | 'streetAddress' | 'buildingName'>,
): string {
    const parts = [
        office.postalCode ? `〒${office.postalCode}` : '',
        office.prefecture,
        office.city,
        office.streetAddress,
        office.buildingName,
    ].filter((part) => part.trim());

    return parts.length > 0 ? parts.join(' ') : '—';
}

/** 事業所番号を5桁に正規化する */
export function normalizeOfficeNumber(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';

    if (OFFICE_NUMBER_PATTERN.test(trimmed)) {
        return trimmed;
    }

    if (/^PN-\d+$/i.test(trimmed)) {
        const seq = Number.parseInt(trimmed.slice(3), 10) || 0;
        return String(seq).padStart(5, '0').slice(-5);
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length > 0) {
        return digits.slice(-5).padStart(5, '0');
    }

    return trimmed;
}
