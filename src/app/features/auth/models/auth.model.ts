import { Timestamp } from 'firebase/firestore';

export type LoginInput = {
    email: string;
    password: string;
};

export type SignupInput = {
    lastName: string;
    firstName: string;
    email: string;
    password: string;
    confirmPassword: string;

    companyName: string;
    representativeName: string;
    companyAddress: string;
};

export type InitialAdminSignupInput = Omit<SignupInput, 'confirmPassword'>;

export type UserRole = 'admin' | 'labor' | 'employee';

export type UserStatus = 'active' | 'inactive';

export type AppUser = {
    uid: string;
    lastName: string;
    firstName: string;
    email: string;

    role: UserRole;
    status: UserStatus;

    createdAt: Timestamp;
    updatedAt: Timestamp;

    companyId: string;
    employeeId: string | null
}

export type AppUserInput = Omit<AppUser, 'createdAt' | 'updatedAt'>;
