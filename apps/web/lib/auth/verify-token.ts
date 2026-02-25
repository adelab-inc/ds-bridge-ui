import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

let adminApp: App;

function getAdminApp(): App {
  if (getApps().length === 0) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      // 개별 환경 변수 방식 (권장)
      adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // JSON 문자열 방식 (fallback)
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      adminApp = initializeApp({
        credential: cert(parsed),
      });
    } else {
      // GCP 환경 (Cloud Run 등)에서는 기본 자격증명 사용
      adminApp = initializeApp();
    }
  }
  return adminApp || getApps()[0];
}

/**
 * Authorization 헤더에서 Firebase ID Token을 검증
 * 성공 시 DecodedIdToken 반환, 실패 시 null
 */
export async function verifyFirebaseToken(
  authHeader: string | null
): Promise<DecodedIdToken | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    return await auth.verifyIdToken(token);
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}
