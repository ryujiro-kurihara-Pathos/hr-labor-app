import { detectFixedWageChanges, sumFixedWageFields } from './fixed-wage-change.util';

describe('detectFixedWageChanges', () => {
    const previous = {
        basicSalary: 300_000,
        commutingAllowance: 10_000,
        positionAllowance: 0,
        housingAllowance: 0,
        fixedOvertimePay: 0,
        otherFixedAllowance: 0,
    };

    it('does not trigger when individual fields change but fixed wage total is unchanged', () => {
        const result = detectFixedWageChanges(
            {
                ...previous,
                basicSalary: 290_000,
                commutingAllowance: 20_000,
            },
            previous,
        );

        expect(sumFixedWageFields(previous)).toBe(310_000);
        expect(result.fixedWageChanged).toBeFalse();
        expect(result.changedFixedWageFields).toEqual([]);
    });

    it('triggers when fixed wage total changes', () => {
        const result = detectFixedWageChanges(
            {
                ...previous,
                basicSalary: 320_000,
            },
            previous,
        );

        expect(result.fixedWageChanged).toBeTrue();
        expect(result.changedFixedWageFields).toEqual(['basicSalary']);
    });

    it('does not trigger when there is no previous month', () => {
        expect(detectFixedWageChanges(previous, null).fixedWageChanged).toBeFalse();
    });
});
