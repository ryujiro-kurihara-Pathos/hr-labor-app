import { extractPrefectureFromAddress, resolveOfficePrefecture } from './office-prefecture.util';

describe('office-prefecture.util', () => {
    describe('extractPrefectureFromAddress', () => {
        it('returns prefecture when included in address text', () => {
            expect(extractPrefectureFromAddress('東京都渋谷区神南1-1-1')).toBe('東京都');
            expect(extractPrefectureFromAddress('大阪府大阪市北区')).toBe('大阪府');
        });

        it('returns null for empty or unmatched address', () => {
            expect(extractPrefectureFromAddress('')).toBeNull();
            expect(extractPrefectureFromAddress('不明な住所')).toBeNull();
        });
    });

    describe('resolveOfficePrefecture', () => {
        it('prefers explicit office prefecture', () => {
            expect(
                resolveOfficePrefecture(
                    { prefecture: '神奈川県', city: '', streetAddress: '横浜市' },
                    '東京都',
                ),
            ).toBe('神奈川県');
        });

        it('falls back to employee prefecture', () => {
            expect(
                resolveOfficePrefecture({ prefecture: '', city: '', streetAddress: '' }, '東京都'),
            ).toBe('東京都');
        });

        it('extracts prefecture from streetAddress when prefecture is empty', () => {
            expect(
                resolveOfficePrefecture({
                    prefecture: '',
                    city: '',
                    streetAddress: '東京都千代田区丸の内1-1',
                }),
            ).toBe('東京都');
        });
    });
});
