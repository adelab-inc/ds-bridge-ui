import { useAuthStore } from '@/stores/useAuthStore';

// 이벤트+roomId 키당 throttle 간격. 동일 사용자가 같은 이상을 연쇄로 만들어도 네트워크 폭주 방지.
const THROTTLE_MS = 5_000;
const lastSentAt = new Map<string, number>();

/**
 * 프로덕션 스트리밍 버그 관측용 fire-and-forget 로그 전송.
 *
 * `/api/debug-log` 엔드포인트로 POST하여 Vercel Functions Logs에 남긴다.
 * 실패해도 사용자 플로우에는 영향 없음.
 *
 * 개인정보 유출 방지를 위해 `context`에는 메시지 원문이 아닌 길이/프리픽스(30자 내외)만 담을 것.
 *
 * 관련 문서: docs/bug-issue/답변중복발행.md
 */
export function sendDebugLog(
  event: string,
  context: Record<string, unknown>
): void {
  const throttleKey = `${event}:${String(context.roomId ?? '')}`;
  const now = Date.now();
  const last = lastSentAt.get(throttleKey) ?? 0;
  if (now - last < THROTTLE_MS) return;
  lastSentAt.set(throttleKey, now);

  void useAuthStore
    .getState()
    .getIdToken()
    .then((token) => {
      if (!token) return;
      return fetch('/api/debug-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ event, context }),
        keepalive: true,
      });
    })
    .catch(() => {
      // intentionally swallow — 디버그 로그 실패는 무해해야 함
    });
}

// dev 전용: 파이프라인 수동 검증용 window 브릿지.
// DevTools 콘솔에서 `window.__sendDebugLog('manual_test', { msg: 'ping' })` 식으로 호출.
// 프로덕션 빌드에선 tree-shaking으로 제거됨.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (
    window as unknown as { __sendDebugLog?: typeof sendDebugLog }
  ).__sendDebugLog = sendDebugLog;
}
