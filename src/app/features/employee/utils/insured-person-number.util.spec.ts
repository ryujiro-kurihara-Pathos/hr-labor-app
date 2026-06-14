import { nextInsuredPersonNumber, resolveInsuredPersonNumberForExport } from './insured-person-number.util';

describe('insured-person-number.util', () => {
    describe('nextInsuredPersonNumber', () => {
        it('returns 1 when no numbers exist', () => {
            expect(nextInsuredPersonNumber([])).toBe('1');
        });

        it('returns max + 1 within the same office sequence', () => {
            expect(nextInsuredPersonNumber(['1', '2', '5'])).toBe('6');
        });

        it('ignores non-numeric values', () => {
            expect(nextInsuredPersonNumber(['abc', '3', ''])).toBe('4');
        });
    });

    describe('resolveInsuredPersonNumberForExport', () => {
        it('prefers procedure snapshot over employee value', () => {
            expect(
                resolveInsuredPersonNumberForExport(
                    { insuredPersonNumber: '2' },
                    { insuredPersonNumber: '7' },
                ),
            ).toBe('7');
        });

        it('falls back to employee value', () => {
            expect(resolveInsuredPersonNumberForExport({ insuredPersonNumber: '3' })).toBe('3');
        });
    });
});
