import { useCallback, useState } from 'react';
import { ChatStreamRequestWithImages } from '@/types/chat';
import type { ChatStreamTriggerResponse } from '@/types/chat';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * AI 서버에 채팅 메시지를 POST로 전송하는 훅
 *
 * SSE 파싱은 제거되었으며, POST 트리거만 수행합니다.
 * AI 응답 스트리밍은 useRoomChannel (Broadcast)로 수신합니다.
 *
 * @returns sendMessage - message_id 반환 (실패 시 null)
 */
export function useChatStream() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (request: ChatStreamRequestWithImages): Promise<string | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await useAuthStore.getState().getIdToken();
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: ChatStreamTriggerResponse = await response.json();
        return data.message_id;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    sendMessage,
    isLoading,
    error,
    reset,
  };
}
