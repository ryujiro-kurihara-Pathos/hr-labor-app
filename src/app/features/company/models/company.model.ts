import { Timestamp } from 'firebase/firestore';

export type Company = {
    id: string;
    name: string;
    representativeName: string;
    address: string;
    createdBy: string;

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type CompanyInput = Omit<Company, 'id' | 'createdAt' | 'updatedAt'>;