import {
    applyPostalLookupResult,
    isValidPostalCodeDigits,
    parseZipcloudResponse,
    PostalCodeLookupError,
} from './postal-code-lookup.util';

describe('postal-code-lookup.util', () => {
    describe('normalizePostalCodeDigits', () => {
        it('removes hyphens and spaces', () => {
            expect(isValidPostalCodeDigits('100-0001')).toBe(true);
        });
    });

    describe('parseZipcloudResponse', () => {
        it('maps zipcloud result to address fields', () => {
            const result = parseZipcloudResponse('1000001', {
                status: 200,
                message: null,
                results: [
                    {
                        zipcode: '1000001',
                        address1: '東京都',
                        address2: '千代田区',
                        address3: '千代田',
                    },
                ],
            });

            expect(result).toEqual({
                postalCode: '1000001',
                prefecture: '東京都',
                city: '千代田区',
                streetAddress: '千代田',
            });
        });

        it('throws when no address is found', () => {
            expect(() =>
                parseZipcloudResponse('0000000', {
                    status: 200,
                    message: null,
                    results: null,
                }),
            ).toThrow(PostalCodeLookupError);
        });
    });

    describe('applyPostalLookupResult', () => {
        it('fills address fields', () => {
            const target = {
                postalCode: '',
                prefecture: '',
                city: '',
                streetAddress: '',
            };

            applyPostalLookupResult(target, {
                postalCode: '1000001',
                prefecture: '東京都',
                city: '千代田区',
                streetAddress: '千代田',
            });

            expect(target.prefecture).toBe('東京都');
            expect(target.city).toBe('千代田区');
            expect(target.streetAddress).toBe('千代田');
        });
    });
});
