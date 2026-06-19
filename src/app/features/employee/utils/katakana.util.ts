/** 全角カタカナ・長音・中点のみ（空白不可） */
const KATAKANA_ONLY_PATTERN = /^[\u30A0-\u30FF]+$/;

export function isKatakanaOnly(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    return KATAKANA_ONLY_PATTERN.test(trimmed);
}

export function katakanaValidationMessage(value: string, label: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return `${label}を入力してください。`;
    if (!isKatakanaOnly(trimmed)) return `${label}は全角カタカナで入力してください。`;
    return null;
}
