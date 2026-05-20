export type LoginInput = {
    email: string;
    password: string;
};

export type SignupInput = {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
};

export type InitialAdminSignupInput = Omit<SignupInput, 'confirmPassword'>;