import { Timestamp } from 'firebase/firestore';

export type LoginInput = {
    email: string;
    password: string;
};

export type SignupInput = {
    lastName: string; // 姓
    firstName: string; // 名
    email: string; // メールアドレス
    password: string; // パスワード
    confirmPassword: string; // 確認用パスワード

    companyName: string; // 会社名
    representativeName: string; // 代表者名
    companyAddress: string; // 会社所在地
};

export type InitialAdminSignupInput = Omit<SignupInput, 'confirmPassword'>;