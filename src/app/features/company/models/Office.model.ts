import { Timestamp } from 'firebase/firestore';

export type HealthInsuranceType = 'kyokai' | 'union'; // 健康保険の種類
export type OfficeStatus = 'active' | 'disabled'; // 事業所のステータス

export type Office = {
    id: string;
    companyId: string; // 会社ID

    name: string; // 事業所名
    address: string; // 所在地
    healthInsuranceType: HealthInsuranceType; // 健康保険の種類

    status: OfficeStatus; // 事業所のステータス

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type OfficeInput = Omit<Office, 'id' | 'createdAt' | 'updatedAt'>;