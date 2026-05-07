'use client';

import * as React from 'react';

import { useChatStream } from '@/hooks/useChatStream';
import { useRoomChannel } from '@/hooks/supabase/useRoomChannel';
import { useStreamingStore } from '@/stores/useStreamingStore';
import { sendDebugLog } from '@/lib/debug-log';
import type { CodeEvent } from '@/types/chat';
import { FIGMA_RATE_LIMIT_CODE } from '@/types/chat';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';

/** 이벤트 간 무활동 허용 시간 (150초) — 이만큼 조용하면 소프트 지연 모드로 전환 */
const STREAM_INACTIVITY_TIMEOUT_MS = 150_000;
/** 스트리밍 총 상한 (6분) — Cloud Run --timeout 300s + Supabase broadcast 유실 방어 60s */
const STREAM_HARD_MAX_MS = 360_000;
/** 소프트 지연 모드에서 DB 폴링 간격 (3초) */
const STREAM_DB_POLL_INTERVAL_MS = 3_000;
/** 중복 chunk 감지 시간 창 — 이 시간 안에 동일 payload가 다시 오면 중복으로 판정 */
const DUP_CHUNK_WINDOW_MS = 5_000;
/** 중복 감지용 ring buffer 최대 크기 — 최근 N개 chunk만 기억 */
const DUP_CHUNK_RECENT_MAX = 30;

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
 * - 2단계 타임아웃 제어:
 *   - inactivity(150s) → 소프트 지연 모드(폴링 + 채널 재구독, status=GENERATING 유지)
 *   - hard_max(360s) → 진짜 ERROR 종결
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
  const setDelayState = useStreamingStore((s) => s.setDelayState);

  const inactivityTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hardMaxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  /** 소프트 지연 모드에서의 3초 간격 폴링 타이머 */
  const pollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Broadcast 콜백에서 사용할 ref (state updater 밖에서 side effect 실행용)
  const pendingQuestionRef = React.useRef<string>('');
  const activeMessageIdRef = React.useRef<string | null>(null);

  // handleSend 이후 onStart가 도착할 때까지 chunk를 drop하기 위한 gate.
  // 이전 응답의 잔여 chunk가 새 streamingMessage에 섞이는 것을 방지한다.
  // (BroadcastChunkPayload에 message_id가 없어 프론트에서 구분 불가능한 한계를 가림)
  const expectingStartRef = React.useRef(false);

  // mid-stream 중복 chunk 감지용 ring buffer.
  // 같은 payload가 짧은 시간 안에 여러 번 도착하는 케이스(서버 이중 publish 혹은
  // Supabase Realtime 중복 전달)를 잡아내 drop한다.
  const recentChunksRef = React.useRef<{ hash: string; ts: number }[]>([]);

  // useRoomChannel.reconnect / schedulePoll의 순환 의존성을 끊기 위한 ref들.
  // useRoomChannel은 콜백 안에서 resetInactivityTimer를 참조해야 하고,
  // resetInactivityTimer는 handleSoftTimeout(reconnect 호출)을 참조하므로
  // reconnect를 ref로 우회한다.
  const reconnectRef = React.useRef<() => void>(() => {});
  const schedulePollRef = React.useRef<() => void>(() => {});

  const [figmaRateLimitOpen, setFigmaRateLimitOpen] = React.useState(false);

  const {
    sendMessage,
    isLoading: isSending,
    error: sendError,
  } = useChatStream();

  const stopPolling = React.useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearAllTimers = React.useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (hardMaxTimerRef.current) {
      clearTimeout(hardMaxTimerRef.current);
      hardMaxTimerRef.current = null;
    }
    stopPolling();
  }, [stopPolling]);

  /**
   * 소프트 지연 모드에서 3초 간격으로 DB를 폴링하여 streamingMessage가 DONE/ERROR로
   * 수렴했는지 확인한다. broadcast가 도착하면 onChunk/onDone/onError 등에서
   * stopPolling 호출 + delayState='normal' 복귀가 일어나므로 자연스럽게 종료된다.
   */
  const schedulePoll = React.useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setTimeout(async () => {
      pollTimerRef.current = null;
      try {
        await refetchMessages();
      } catch {
        /* network blip 정도는 무시하고 다음 tick 기다림 */
      }
      const s = useStreamingStore.getState();
      // refetch 결과로 onDone 경로(setStreamingMessage(null))가 발화했을 수 있다.
      // 메시지가 사라졌거나 지연 모드에서 빠져나왔다면 추가 polling 불필요.
      if (s.message && s.delayState === 'delayed_polling') {
        schedulePollRef.current();
      }
    }, STREAM_DB_POLL_INTERVAL_MS);
  }, [refetchMessages]);

  React.useEffect(() => {
    schedulePollRef.current = schedulePoll;
  });

  /**
   * 150초 무음 시점에 호출. ERROR로 종결하지 않고 소프트 지연 모드로 진입한다.
   * 1) UI 배너 노출용 delayState='delayed_polling'
   * 2) 채널이 stale일 가능성 → reconnect 1회 강제
   * 3) DB 폴링 시작(3초 간격) — 서버가 조용히 generate 끝내고 DB만 갱신한 경우 회복
   * inactivityTimerRef는 더 이상 재가동하지 않는다(broadcast가 다시 오면
   * resetInactivityTimer에서 정상 모드로 복귀하면서 다시 시작됨).
   */
  const handleSoftTimeout = React.useCallback(() => {
    if (!useStreamingStore.getState().message) return;
    setDelayState('delayed_polling');
    sendDebugLog('stream_inactivity_soft', {
      roomId,
      message_id: activeMessageIdRef.current,
    });
    reconnectRef.current();
    refetchMessages().catch(() => {});
    schedulePoll();
  }, [setDelayState, roomId, refetchMessages, schedulePoll]);

  const resetInactivityTimer = React.useCallback(() => {
    // 어떤 broadcast 이벤트든 도착했다는 신호 → 지연 모드/폴링 해제
    if (useStreamingStore.getState().delayState === 'delayed_polling') {
      setDelayState('normal');
      stopPolling();
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(
      handleSoftTimeout,
      STREAM_INACTIVITY_TIMEOUT_MS
    );
  }, [setDelayState, stopPolling, handleSoftTimeout]);

  /**
   * 6분 도달 시 호출. 그동안 폴링/재구독으로도 수렴하지 못했다면 진짜 ERROR로 종결.
   */
  const handleHardTimeout = React.useCallback(() => {
    expectingStartRef.current = false;
    activeMessageIdRef.current = null;
    const now = Date.now();
    setDelayState('failed');
    updateStreamingMessage((prev) =>
      prev
        ? {
            ...prev,
            text:
              prev.text ||
              '응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.',
            status: 'ERROR' as const,
            answer_created_at: now,
          }
        : prev
    );
    sendDebugLog('stream_inactivity_hard', {
      roomId,
      message_id: activeMessageIdRef.current,
    });
    clearAllTimers();
    onStreamEnd?.();
  }, [
    clearAllTimers,
    onStreamEnd,
    updateStreamingMessage,
    setDelayState,
    roomId,
  ]);

  const finishStreaming = React.useCallback(() => {
    clearAllTimers();
    onStreamEnd?.();
  }, [clearAllTimers, onStreamEnd]);

  const { reconnect } = useRoomChannel({
    roomId,
    enabled: !!roomId,
    callbacks: {
      onStart: (payload) => {
        // start 도착 → 해당 응답이 실제로 시작됨. 이전 누수 chunk를 제거하기 위해
        // text/content/path를 리셋하고 chunk gate를 연다.
        expectingStartRef.current = false;
        activeMessageIdRef.current = payload.message_id;
        updateStreamingMessage((prev) => {
          if (prev) {
            return {
              ...prev,
              id: payload.message_id,
              text: '',
              content: '',
              path: '',
            };
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

        // start 이전에 도착한 chunk는 이전 응답의 잔여분일 가능성이 높아 drop.
        // BroadcastChunkPayload에 message_id가 없어 달리 구분할 방법이 없음.
        if (expectingStartRef.current) {
          console.warn(
            '[ChatSection] onChunk: pre-start, dropping (likely leaked from previous response)',
            { type: payload.type, len: payload.text?.length }
          );
          sendDebugLog('pre_start_drop', {
            roomId,
            type: payload.type,
            len: payload.text?.length,
            head: payload.text?.slice(0, 30),
          });
          return;
        }

        // mid-stream 중복 chunk 감지. 동일 payload가 DUP_CHUNK_WINDOW_MS 안에 다시
        // 도착하면 드롭 + 관측 로그 전송. Supabase Realtime 중복 전달 혹은 AI 서버
        // 이중 publish 상황에서 텍스트 중복 출력의 주된 원인.
        const hash = `${payload.type}:${payload.text ?? ''}:${payload.content ?? ''}:${payload.path ?? ''}`;
        const nowTs = Date.now();
        const cutoff = nowTs - DUP_CHUNK_WINDOW_MS;
        recentChunksRef.current = recentChunksRef.current.filter(
          (c) => c.ts > cutoff
        );
        const dup = recentChunksRef.current.find((c) => c.hash === hash);
        if (dup) {
          console.warn('[ChatSection] onChunk: duplicate chunk, dropping', {
            gap_ms: nowTs - dup.ts,
            type: payload.type,
            len: payload.text?.length,
          });
          sendDebugLog('duplicate_chunk', {
            roomId,
            gap_ms: nowTs - dup.ts,
            type: payload.type,
            len: payload.text?.length,
            head: payload.text?.slice(0, 30),
          });
          return;
        }
        recentChunksRef.current.push({ hash, ts: nowTs });
        if (recentChunksRef.current.length > DUP_CHUNK_RECENT_MAX) {
          recentChunksRef.current.shift();
        }

        console.log('[onChunk]', {
          ts: Date.now(),
          len: payload.text?.length,
          head: payload.text?.slice(0, 30),
          tail: payload.text?.slice(-30),
          type: payload.type,
        });
        // state updater는 순수 함수로 유지 (side effect 금지)
        updateStreamingMessage((prev) => {
          if (!prev) {
            console.warn('[ChatSection] onChunk: prev is NULL, dropping chunk');
            sendDebugLog('null_prev_drop', {
              roomId,
              type: payload.type,
              len: payload.text?.length,
              head: payload.text?.slice(0, 30),
            });
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
        expectingStartRef.current = false;
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
        expectingStartRef.current = false;
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

  React.useEffect(() => {
    reconnectRef.current = reconnect;
  }, [reconnect]);

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

      // 새 세션 시작 → onStart 수신 전까지 chunk를 drop하여
      // 이전 응답 잔여 broadcast가 새 streamingMessage에 섞이지 않도록 한다.
      expectingStartRef.current = true;

      // 중복 감지 버퍼 초기화 — 이전 세션의 hash가 새 세션에 오탐을 유발하지 않도록.
      recentChunksRef.current = [];

      // Zustand store에 직접 설정 (React 배칭 영향 없음)
      // setStreamingMessage(non-null)는 delayState를 자동 리셋하지 않으므로 명시적 호출.
      setDelayState('normal');
      setStreamingMessage(newMessage);

      // 이미지 초기화 (전송 후)
      clearImages();

      // 부모 컴포넌트에 스트리밍 시작 알림
      onStreamStart?.();

      // 타임아웃 설정
      // - inactivity: broadcast 이벤트 간 150초 무음 → 소프트 지연 모드
      // - hard_max: 총 6분 상한 (Cloud Run 300s + 방어 60s) → 진짜 ERROR
      clearAllTimers();
      resetInactivityTimer();
      hardMaxTimerRef.current = setTimeout(handleHardTimeout, STREAM_HARD_MAX_MS);

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
        expectingStartRef.current = false;
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
      setDelayState,
      updateStreamingMessage,
      clearImages,
      onStreamStart,
      onStreamEnd,
      clearAllTimers,
      resetInactivityTimer,
      handleHardTimeout,
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
