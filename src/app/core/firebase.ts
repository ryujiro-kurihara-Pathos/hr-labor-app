import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth, useDeviceLanguage } from 'firebase/auth';


// 接続するプロジェクト情報
const firebaseConfig = {
  apiKey: "AIzaSyCfqh3fQGaPOMC_CzH6po3osmnYjylLYR4",
  authDomain: "kensyu10143.firebaseapp.com",
  projectId: "kensyu10143",
  storageBucket: "kensyu10143.firebasestorage.app",
  messagingSenderId: "145416194664",
  appId: "1:145416194664:web:c918c749d29c4b34c749dd",
  measurementId: "G-HKCRG49S8R"
};


// Firebaseの初期化
const app = initializeApp(firebaseConfig);

// Firestore, Authenticationの初期化
export const db = getFirestore(app, 'hr-labor-app');
export const auth = getAuth(app);

// デバイスの言語を使用する
useDeviceLanguage(auth);