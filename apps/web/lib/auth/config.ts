/** 인증 없이 접근 가능한 라우트 */
export const PUBLIC_ROUTES = ['/login', '/auth/callback'] as const;

/** localStorage에 이메일을 저장하는 키 (magic link flow) */
export const EMAIL_STORAGE_KEY = 'emailForSignIn';
