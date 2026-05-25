import { Timestamp } from 'firebase/firestore';
import { UserRole } from '../../users/models/user.model';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'rejected';

export type Invitation = {
    id: string;

    email: string;

    companyId: string;
    role: UserRole;
    status: InvitationStatus;

    invitedBy: string;

    createdAt: Timestamp;
    updatedAt: Timestamp;
    expiresAt: Timestamp;
}

export type InvitationInput = Omit<Invitation, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'expiresAt'>;