import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * Firebase 설정
 * 환경 변수에서 Firebase 설정 값을 가져옵니다.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/**
 * Firebase App 초기화
 * 이미 초기화된 앱이 있으면 재사용하고, 없으면 새로 초기화합니다.
 */
let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

/**
 * Firebase 서비스 인스턴스
 * - initializeAuth: 탭 종료 후에도 로그인 유지 (browserLocalPersistence)
 * - getAuth: 이미 초기화된 경우 재사용
 */
export const firebaseAuth: Auth =
  typeof window !== 'undefined'
    ? initializeAuth(app, { persistence: browserLocalPersistence })
    : getAuth(app);
export const firebaseFirestore: Firestore = getFirestore(app);
export const firebaseStorage: FirebaseStorage = getStorage(app);

export default app;
