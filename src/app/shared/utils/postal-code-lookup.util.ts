export type PostalCodeLookupResult = {
    postalCode: string;
    prefecture: string;
    city: string;
    streetAddress: string;
};

export class PostalCodeLookupError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PostalCodeLookupError';
    }
}

export function normalizePostalCodeDigits(postalCode: string): string {
    return postalCode.replace(/\D/g, '');
}

export function isValidPostalCodeDigits(postalCode: string): boolean {
    return /^\d{7}$/.test(normalizePostalCodeDigits(postalCode));
}

type ZipcloudResponse = {
    message: string | null;
    results: Array<{
        zipcode: string;
        address1: string;
        address2: string;
        address3: string;
    }> | null;
    status: number;
};

export function parseZipcloudResponse(
    postalCode: string,
    data: ZipcloudResponse,
): PostalCodeLookupResult {
    if (data.status !== 200) {
        throw new PostalCodeLookupError(data.message ?? '郵便番号の検索に失敗しました');
    }

    const results = data.results ?? [];
    if (results.length === 0) {
        throw new PostalCodeLookupError('該当する住所が見つかりませんでした');
    }

    const match = results[0];
    return {
        postalCode: normalizePostalCodeDigits(postalCode),
        prefecture: match.address1,
        city: match.address2,
        streetAddress: match.address3,
    };
}

export function applyPostalLookupResult(
    target: {
        postalCode: string;
        prefecture: string;
        city: string;
        streetAddress: string;
    },
    result: PostalCodeLookupResult,
): void {
    target.postalCode = result.postalCode;
    target.prefecture = result.prefecture;
    target.city = result.city;
    target.streetAddress = result.streetAddress;
}
