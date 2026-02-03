import { useMutation } from '@tanstack/react-query';
import type { paths } from '@ds-hub/shared-types/typescript/api/schema';

type ChatSendRequest =
  paths['/chat']['post']['requestBody']['content']['application/json'];
type ChatSendResponse =
  paths['/chat']['post']['responses']['200']['content']['application/json'];

// ============================================================================
// Query Keys
// ============================================================================

export const chatKeys = {
  all: ['chat'] as const,
  messages: (roomId: string) => [...chatKeys.all, 'messages', roomId] as const,
};

// ============================================================================
// Mutations
// ============================================================================

/**
 * POST /api/chat - AI 채팅 (Non-streaming)
 */
export function useSendMessage() {
  return useMutation({
    mutationFn: async (data: ChatSendRequest): Promise<ChatSendResponse> => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail?.[0]?.msg ||
            `Failed to send message: ${response.statusText}`
        );
      }

      return response.json();
    },
  });
}

// ============================================================================
// Stream (기존 useChatStream 훅 사용)
// ============================================================================

/**
 * POST /api/chat/stream - AI 채팅 (Streaming)
 *
 * Note: 스트리밍은 별도의 useChatStream 훅 사용
 * @see /hooks/useChatStream.ts
 */
