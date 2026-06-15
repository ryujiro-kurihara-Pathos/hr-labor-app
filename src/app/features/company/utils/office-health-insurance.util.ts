import { HealthInsuranceType } from '../models/office.model';

export const HEALTH_INSURANCE_TYPE_LABEL = '協会けんぽ';

/** 本アプリは協会けんぽのみ対応 */
export function normalizeHealthInsuranceType(
    type: HealthInsuranceType | null | undefined,
): HealthInsuranceType {
    return 'kyokai';
}

export function healthInsuranceTypeLabel(
    type: HealthInsuranceType | null | undefined,
): string {
    return HEALTH_INSURANCE_TYPE_LABEL;
}
