import { create } from 'zustand';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';

/**
 * 스트리밍 메시지의 지연 상태.
 * - normal: 정상 흐름
 * - delayed_polling: inactivity timeout(150s)이 떴지만 서버는 아직 generate 중일 수 있어
 *   broadcast 대신 DB 폴링으로 결과를 확인하는 단계
 * - failed: hard_max(360s)까지도 결과가 오지 않아 실제 ERROR로 종결한 단계
 */
export type StreamingDelayState = 'normal' | 'delayed_polling' | 'failed';

interface StreamingState {
  /** 현재 스트리밍 중인 메시지 (null = 스트리밍 없음) */
  message: ChatMessage | null;

  /** broadcast 무음 시 UI 분기를 위한 보조 상태 */
  delayState: StreamingDelayState;

  /** 직접 값 설정 — null로 리셋 시 delayState도 자동 'normal'로 복귀 */
  setMessage: (msg: ChatMessage | null) => void;

  /** functional update (prev => next) */
  updateMessage: (
    updater: (prev: ChatMessage | null) => ChatMessage | null
  ) => void;

  /** 지연 상태 갱신 */
  setDelayState: (next: StreamingDelayState) => void;
}

/**
 * 스트리밍 메시지 전용 Zustand 스토어
 *
 * React의 useState 대신 사용하여 배칭/동시성 렌더링에 의한
 * state 유실 문제를 방지합니다.
 */
export const useStreamingStore = create<StreamingState>((set, get) => ({
  message: null,
  delayState: 'normal',

  setMessage: (msg) =>
    set(
      msg === null
        ? { message: null, delayState: 'normal' }
        : { message: msg }
    ),

  updateMessage: (updater) => set({ message: updater(get().message) }),

  setDelayState: (next) => set({ delayState: next }),
}));
