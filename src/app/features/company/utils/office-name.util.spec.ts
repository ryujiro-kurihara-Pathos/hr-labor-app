import { isDuplicateOfficeName, normalizeOfficeName } from './office-name.util';

describe('office-name.util', () => {
    const offices = [
        { id: 'o1', name: '本社' },
        { id: 'o2', name: ' 大阪支店 ' },
    ];

    it('normalizes office name by trimming', () => {
        expect(normalizeOfficeName(' 本社 ')).toBe('本社');
    });

    it('detects duplicate office names within the same company list', () => {
        expect(isDuplicateOfficeName(offices, '本社')).toBeTrue();
        expect(isDuplicateOfficeName(offices, ' 本社 ')).toBeTrue();
        expect(isDuplicateOfficeName(offices, '大阪支店')).toBeTrue();
        expect(isDuplicateOfficeName(offices, '名古屋支店')).toBeFalse();
    });

    it('ignores the excluded office when checking duplicates', () => {
        expect(isDuplicateOfficeName(offices, '本社', 'o1')).toBeFalse();
    });
});
