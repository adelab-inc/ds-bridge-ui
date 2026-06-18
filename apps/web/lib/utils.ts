import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 64자 SHA-256 해시를 git 약식(앞 7자)으로 줄인다. 화면 뱃지 표시 전용.
 * (비교/식별은 항상 풀 해시로 한다.)
 *
 * 서버가 `*_hash_short` 를 내려주면 그 값을 우선 쓰고, 코드 메시지처럼
 * 풀 해시만 내려오는 경로에서는 이 헬퍼로 약식을 만든다.
 */
export function shortHash(hash?: string | null, length = 7): string | null {
  if (!hash) return null;
  return hash.slice(0, length);
}

/** 삭제 실패 HTTP 상태를 사용자용 한글 메시지로 변환한다. */
export function deleteErrorMessage(
  status: number,
  target: 'room' | 'message'
): string {
  const label = target === 'room' ? '채팅방' : '메시지';
  switch (status) {
    case 401:
      return '로그인이 필요합니다. 다시 로그인해 주세요.';
    case 403:
      return `본인 소유의 ${label}만 삭제할 수 있습니다.`;
    case 404:
      return `${label}을(를) 찾을 수 없습니다.`;
    default:
      return `${label} 삭제에 실패했습니다. (오류 ${status})`;
  }
}
