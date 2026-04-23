'use client';

import * as React from 'react';

import { useChatStream } from '@/hooks/useChatStream';
import { useRoomChannel } from '@/hooks/supabase/useRoomChannel';
import { useStreamingStore } from '@/stores/useStreamingStore';
import type { CodeEvent } from '@/types/chat';
import { FIGMA_RATE_LIMIT_CODE } from '@/types/chat';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';

/** 이벤트 간 무활동 허용 시간 (150초) — 마지막 broadcast 이벤트 이후 이만큼 조용하면 타임아웃 */
const STREAM_INACTIVITY_TIMEOUT_MS = 150_000;
/** 스트리밍 총 상한 (6분) — Cloud Run --timeout 300s + Supabase broadcast 유실 방어 60s */
const STREAM_HARD_MAX_MS = 360_000;

interface UseChatStreamLifecycleArgs {
  roomId: string;
  uploadedUrls: string[];
  clearImages: () => void;
  selectedMessageId: string | null;
  refetchMessages: () => Promise<unknown>;
  updateSelectedMessageId: (messageId: string | null) => void;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onCodeGenerated?: (code: CodeEvent) => void;
}

/**
 * 채팅 스트리밍 라이프사이클 전체를 캡슐화하는 훅.
 *
 * 책임:
 * - `useChatStream`(POST) + `useRoomChannel`(broadcast 수신) 조합
 * - `useStreamingStore` 기반 optimistic streaming 메시지 관리
 * - inactivity(150s) / hard_max(360s) 타임아웃 제어
 * - Figma 429 전용 모달 open state 노출
 *
 * 규칙:
 * - `updateStreamingMessage`의 updater는 **순수 함수**로 유지. side effect는
 *   state updater 바깥에서 실행해야 StrictMode 더블 렌더 시 중복 호출 방지.
 * - `pendingQuestionRef` / `activeMessageIdRef` 두 ref는 반드시 같은 훅 안에서만
 *   공유해야 한다. 분리하면 onStart에서 pendingQuestion 복원이 깨진다.
 */
export function useChatStreamLifecycle({
  roomId,
  uploadedUrls,
  clearImages,
  selectedMessageId,
  refetchMessages,
  updateSelectedMessageId,
  onStreamStart,
  onStreamEnd,
  onCodeGenerated,
}: UseChatStreamLifecycleArgs) {
  const streamingMessage = useStreamingStore((s) => s.message);
  const setStreamingMessage = useStreamingStore((s) => s.setMessage);
  const updateStreamingMessage = useStreamingStore((s) => s.updateMessage);

  const inactivityTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hardMaxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Broadcast 콜백에서 사용할 ref (state updater 밖에서 side effect 실행용)
  const pendingQuestionRef = React.useRef<string>('');
  const activeMessageIdRef = React.useRef<string | null>(null);

  const [figmaRateLimitOpen, setFigmaRateLimitOpen] = React.useState(false);

  const { sendMessage, isLoading: isSending, error: sendError } = useChatStream();

  const clearAllTimers = React.useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (hardMaxTimerRef.current) {
      clearTimeout(hardMaxTimerRef.current);
      hardMaxTimerRef.current = null;
    }
  }, []);

  const handleTimeout = React.useCallback(
    (reason: 'inactivity' | 'hard_max') => {
      activeMessageIdRef.current = null;
      const now = Date.now();
      updateStreamingMessage((prev) =>
        prev
          ? {
              ...prev,
              text:
                prev.text ||
                (reason === 'inactivity'
                  ? 'Error: 응답 지연 (150초 동안 새 이벤트 없음)'
                  : 'Error: 응답 시간 초과 (최대 6분)'),
              status: 'ERROR' as const,
              answer_created_at: now,
            }
          : prev
      );
      clearAllTimers();
      onStreamEnd?.();
    },
    [clearAllTimers, onStreamEnd, updateStreamingMessage]
  );

  const resetInactivityTimer = React.useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(
      () => handleTimeout('inactivity'),
      STREAM_INACTIVITY_TIMEOUT_MS
    );
  }, [handleTimeout]);

  const finishStreaming = React.useCallback(() => {
    clearAllTimers();
    onStreamEnd?.();
  }, [clearAllTimers, onStreamEnd]);

  useRoomChannel({
    roomId,
    enabled: !!roomId,
    callbacks: {
      onStart: (payload) => {
        activeMessageIdRef.current = payload.message_id;
        updateStreamingMessage((prev) => {
          if (prev) {
            return { ...prev, id: payload.message_id };
          }
          // handleSend의 state가 아직 반영되지 않은 경우 ref에서 질문 복원
          return {
            id: payload.message_id,
            question: pendingQuestionRef.current,
            text: '',
            content: '',
            path: '',
            room_id: roomId,
            question_created_at: Date.now(),
            answer_created_at: 0,
            status: 'GENERATING' as const,
          };
        });
        resetInactivityTimer();
      },
      onChunk: (payload) => {
        // heartbeat는 타이머 리셋만 하고 상태 업데이트 스킵
        if (payload.type === 'heartbeat') {
          resetInactivityTimer();
          return;
        }

        // state updater는 순수 함수로 유지 (side effect 금지)
        updateStreamingMessage((prev) => {
          if (!prev) {
            console.warn('[ChatSection] onChunk: prev is NULL, dropping chunk');
            return prev;
          }

          if (payload.type === 'chat' && payload.text) {
            return { ...prev, text: prev.text + payload.text };
          }

          if (payload.type === 'code') {
            return {
              ...prev,
              content: payload.content ?? prev.content,
              path: payload.path ?? prev.path,
            };
          }

          console.warn('[ChatSection] onChunk: unknown type', payload);
          return prev;
        });

        // side effect는 state updater 바깥에서 실행
        if (payload.type === 'code' && payload.content) {
          const msgId = activeMessageIdRef.current;
          if (msgId) updateSelectedMessageId(msgId);
          onCodeGenerated?.({
            type: 'code',
            content: payload.content,
            path: payload.path ?? '',
          });
        }

        resetInactivityTimer();
      },
      onDone: (payload) => {
        activeMessageIdRef.current = null;

        clearAllTimers();
        onStreamEnd?.();

        updateStreamingMessage((prev) =>
          prev
            ? {
                ...prev,
                text: payload.text || prev.text,
                status: 'DONE' as const,
                answer_created_at: Date.now(),
              }
            : null
        );

        refetchMessages()
          .then(() => setStreamingMessage(null))
          .catch(() => setStreamingMessage(null));
      },
      onError: (payload) => {
        activeMessageIdRef.current = null;
        const now = Date.now();
        const isFigmaRateLimit = payload.error_code === FIGMA_RATE_LIMIT_CODE;
        if (isFigmaRateLimit) {
          setFigmaRateLimitOpen(true);
        }
        updateStreamingMessage((prev) =>
          prev
            ? {
                ...prev,
                // rate limit은 모달로 안내하므로 채팅 버블 본문은 간결하게
                text: isFigmaRateLimit ? '' : `Error: ${payload.error}`,
                status: 'ERROR' as const,
                answer_created_at: now,
              }
            : prev
        );
        finishStreaming();
      },
    },
  });

  const handleSend = React.useCallback(
    async (message: string) => {
      const tempId = crypto.randomUUID();

      // 업로드 완료된 이미지 URL 캡처
      const imageUrls = uploadedUrls.length > 0 ? [...uploadedUrls] : undefined;

      // Optimistic UI: streamingMessage 즉시 생성
      const newMessage: ChatMessage = {
        id: tempId,
        question: imageUrls
          ? `[이미지 ${imageUrls.length}개] ${message}`
          : message,
        text: '',
        content: '',
        path: '',
        room_id: roomId,
        question_created_at: Date.now(),
        answer_created_at: 0,
        status: 'GENERATING',
      };

      pendingQuestionRef.current = newMessage.question;
      activeMessageIdRef.current = tempId;

      // Zustand store에 직접 설정 (React 배칭 영향 없음)
      setStreamingMessage(newMessage);

      // 이미지 초기화 (전송 후)
      clearImages();

      // 부모 컴포넌트에 스트리밍 시작 알림
      onStreamStart?.();

      // 타임아웃 설정
      // - inactivity: broadcast 이벤트 간 150초 무음이면 타임아웃
      // - hard_max: 총 6분 상한 (Cloud Run 300s + 방어 60s)
      clearAllTimers();
      resetInactivityTimer();
      hardMaxTimerRef.current = setTimeout(
        () => handleTimeout('hard_max'),
        STREAM_HARD_MAX_MS
      );

      // AI에게 메시지 전송
      const messageId = await sendMessage({
        message,
        room_id: roomId,
        stream: true,
        from_message_id: selectedMessageId ?? undefined,
        image_urls: imageUrls,
      });

      if (messageId) {
        // tempId → message_id 즉시 갱신 (onStart 도착 전 dedup 보장)
        activeMessageIdRef.current = messageId;
        updateStreamingMessage((prev) =>
          prev ? { ...prev, id: messageId } : prev
        );
      } else {
        // POST 실패 시 에러 처리
        activeMessageIdRef.current = null;
        const now = Date.now();
        updateStreamingMessage((prev) =>
          prev
            ? {
                ...prev,
                text: 'Error: 메시지 전송 실패',
                status: 'ERROR' as const,
                answer_created_at: now,
              }
            : prev
        );
        clearAllTimers();
        onStreamEnd?.();
      }
    },
    [
      uploadedUrls,
      roomId,
      setStreamingMessage,
      updateStreamingMessage,
      clearImages,
      onStreamStart,
      onStreamEnd,
      clearAllTimers,
      resetInactivityTimer,
      handleTimeout,
      sendMessage,
      selectedMessageId,
    ]
  );

  // 언마운트 시 남은 타이머 정리
  React.useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const isLoading = isSending || !!streamingMessage;

  return {
    handleSend,
    isLoading,
    streamingMessage,
    sendError,
    figmaRateLimitOpen,
    setFigmaRateLimitOpen,
  };
}
