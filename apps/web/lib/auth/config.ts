/**
 * Firebase Email Link Authentication 설정
 */

/** 인증 없이 접근 가능한 라우트 */
export const PUBLIC_ROUTES = ['/login', '/auth/callback'] as const;

/** 미들웨어용 세션 쿠키 이름 */
export const AUTH_SESSION_COOKIE = '__session';

/** localStorage에 이메일을 저장하는 키 (email link flow) */
export const EMAIL_STORAGE_KEY = 'emailForSignIn';

/**
 * sendSignInLinkToEmail에 전달할 ActionCodeSettings
 * callback URL은 Firebase Console > Authentication > Authorized domains에 등록 필요
 */
export function getActionCodeSettings(): {
  url: string;
  handleCodeInApp: boolean;
} {
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5555';

  return {
    url: `${baseUrl}/auth/callback`,
    handleCodeInApp: true,
  };
}
