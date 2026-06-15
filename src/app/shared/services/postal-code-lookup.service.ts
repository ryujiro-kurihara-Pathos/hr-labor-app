import { Injectable } from '@angular/core';

import {
    isValidPostalCodeDigits,
    normalizePostalCodeDigits,
    parseZipcloudResponse,
    PostalCodeLookupError,
    PostalCodeLookupResult,
} from '../utils/postal-code-lookup.util';

@Injectable({ providedIn: 'root' })
export class PostalCodeLookupService {
    async lookup(postalCode: string): Promise<PostalCodeLookupResult> {
        const digits = normalizePostalCodeDigits(postalCode);
        if (!isValidPostalCodeDigits(digits)) {
            throw new PostalCodeLookupError('郵便番号は7桁で入力してください');
        }

        const response = await fetch(
            `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`,
        );
        if (!response.ok) {
            throw new PostalCodeLookupError('郵便番号の検索に失敗しました');
        }

        const data = await response.json();
        return parseZipcloudResponse(digits, data);
    }

    toUserMessage(error: unknown): string {
        if (error instanceof PostalCodeLookupError) {
            return error.message;
        }
        return '郵便番号の検索に失敗しました';
    }
}
