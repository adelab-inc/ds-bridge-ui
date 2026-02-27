'use client';

import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type {
  BroadcastStartPayload,
  BroadcastChunkPayload,
  BroadcastDonePayload,
  BroadcastErrorPayload,
} from '@/types/chat';

interface UseRoomChannelCallbacks {
  onStart?: (payload: BroadcastStartPayload) => void;
  onChunk?: (payload: BroadcastChunkPayload) => void;
  onDone?: (payload: BroadcastDonePayload) => void;
  onError?: (payload: BroadcastErrorPayload) => void;
}

interface UseRoomChannelOptions {
  roomId: string;
  enabled?: boolean;
  callbacks: UseRoomChannelCallbacks;
}

/** 최대 재연결 시도 횟수 */
const MAX_RETRIES = 5;

/**
 * Room Broadcast 채널 구독 훅
 *
 * room:{roomId} 채널에서 start / chunk / done / error 이벤트를 수신합니다.
 * AI 서버가 Supabase Realtime REST API로 직접 발행하는 이벤트를 수신합니다.
 *
 * - Ref 기반 채널 관리로 React Strict Mode double-mount 문제를 방지합니다.
 * - TIMED_OUT / CHANNEL_ERROR / CLOSED 시 지수 백오프로 자동 재연결합니다.
 * - 탭 복귀(visibilitychange) 시 채널 상태를 즉시 확인하여 복구합니다.
 */
export function useRoomChannel({
  roomId,
  enabled = true,
  callbacks,
}: UseRoomChannelOptions) {
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // setupChannel을 ref로 노출 (visibilitychange 핸들러에서 호출 가능)
  const setupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!roomId || !enabled) {
      setupRef.current = null;
      return;
    }

    // 이미 같은 roomId로 구독 중이면 skip (Strict Mode 대응)
    if (channelRef.current && roomIdRef.current === roomId) return;

    const supabase = createClient();

    function setupChannel() {
      // 이전 채널 정리 (removeChannel → CLOSED 콜백 발생하지만 stale guard로 무시됨)
      const oldChannel = channelRef.current;
      channelRef.current = null;
      if (oldChannel) {
        supabase.removeChannel(oldChannel);
      }

      const channel = supabase.channel(`room:${roomId}`);
      channelRef.current = channel;
      roomIdRef.current = roomId;

      channel
        .on('broadcast', { event: 'start' }, (msg) => {
          callbacksRef.current.onStart?.(msg.payload as BroadcastStartPayload);
        })
        .on('broadcast', { event: 'chunk' }, (msg) => {
          callbacksRef.current.onChunk?.(msg.payload as BroadcastChunkPayload);
        })
        .on('broadcast', { event: 'done' }, (msg) => {
          callbacksRef.current.onDone?.(msg.payload as BroadcastDonePayload);
        })
        .on('broadcast', { event: 'error' }, (msg) => {
          callbacksRef.current.onError?.(msg.payload as BroadcastErrorPayload);
        })
        .subscribe((status) => {
          console.log(`[useRoomChannel] status: ${status}, room: ${roomId}`);

          // 이미 교체된 (stale) 채널이면 무시
          if (channelRef.current !== channel) return;

          if (status === 'SUBSCRIBED') {
            retryCountRef.current = 0;
          } else if (
            status === 'TIMED_OUT' ||
            status === 'CHANNEL_ERROR' ||
            status === 'CLOSED'
          ) {
            console.warn(
              `[useRoomChannel] reconnecting (retry ${retryCountRef.current + 1}/${MAX_RETRIES})`
            );
            scheduleReconnect();
          }
        });
    }

    function scheduleReconnect() {
      if (retryCountRef.current >= MAX_RETRIES) {
        channelRef.current = null;
        roomIdRef.current = null;
        return;
      }

      // 지수 백오프: 1s, 2s, 4s, 8s, 16s (최대 30s)
      const delay = Math.min(1000 * 2 ** retryCountRef.current, 30_000);
      retryCountRef.current += 1;

      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(setupChannel, delay);
    }

    setupRef.current = setupChannel;
    setupChannel();

    // Strict Mode cleanup에서는 채널을 제거하지 않음
    // roomId 변경 시 다음 effect에서 처리, unmount 시 아래 cleanup에서 처리
    return () => {};
  }, [roomId, enabled]);

  // 탭 복귀 시 채널 상태 확인 → 비정상이면 즉시 재구독
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      const channel = channelRef.current;
      if (!channel) return;

      // 'joined' = 정상 구독 중, 'joining' = 구독 진행 중 → 정상
      const state = (channel as unknown as { state: string }).state;
      if (state === 'joined' || state === 'joining') return;

      // 채널이 비정상 상태 → 재시도 카운터 리셋 후 즉시 재구독
      retryCountRef.current = 0;
      setupRef.current?.();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 컴포넌트 unmount 시 채널 + 재연결 타이머 정리
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (channelRef.current) {
        const supabase = createClient();
        const channel = channelRef.current;
        // ref를 먼저 null로 설정 → removeChannel의 동기 CLOSED 콜백이 stale guard에 걸림
        channelRef.current = null;
        roomIdRef.current = null;
        supabase.removeChannel(channel);
      }
    };
  }, []);
}
