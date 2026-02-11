import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import {
  getActionCodeSettings,
  EMAIL_STORAGE_KEY,
  AUTH_SESSION_COOKIE,
} from './config';

/**
 * 이메일로 sign-in 링크 전송
 * localStorage에 email 저장 (같은 브라우저에서 callback 시 자동 완료용)
 */
export async function sendSignInLink(email: string): Promise<void> {
  const actionCodeSettings = getActionCodeSettings();
  await sendSignInLinkToEmail(firebaseAuth, email, actionCodeSettings);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
  }
}

/** 현재 URL이 email sign-in 링크인지 확인 */
export function isEmailSignInLink(url: string): boolean {
  return isSignInWithEmailLink(firebaseAuth, url);
}

/**
 * email link로 sign-in 완료
 * 성공 시 localStorage에서 email 제거
 */
export async function completeSignInWithEmailLink(
  email: string,
  url: string
): Promise<User> {
  const result = await signInWithEmailLink(firebaseAuth, email, url);

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
  }

  return result.user;
}

/** localStorage에서 저장된 email 조회 */
export function getStoredEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(EMAIL_STORAGE_KEY);
}

/** 로그아웃 + 세션 쿠키 삭제 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(firebaseAuth);

  if (typeof window !== 'undefined') {
    document.cookie = `${AUTH_SESSION_COOKIE}=; path=/; max-age=0`;
  }
}

/** 현재 사용자의 ID Token 반환 (미인증 시 null) */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}
