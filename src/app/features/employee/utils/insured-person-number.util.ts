/** 事業所内の既存被保険者整理番号から次の連番を採番する */
export function nextInsuredPersonNumber(existingNumbers: readonly string[]): string {
    let max = 0;

    for (const raw of existingNumbers) {
        const number = raw.trim();
        if (!/^\d+$/.test(number)) continue;
        max = Math.max(max, Number(number));
    }

    return String(max + 1);
}

export function insuredPersonNumberLabel(value: string | null | undefined): string {
    return value?.trim() ?? '';
}

export function resolveInsuredPersonNumberForExport(
    employee: { insuredPersonNumber?: string | null },
    procedure?: { insuredPersonNumber?: string | null } | null,
): string {
    return insuredPersonNumberLabel(procedure?.insuredPersonNumber)
        || insuredPersonNumberLabel(employee.insuredPersonNumber);
}
