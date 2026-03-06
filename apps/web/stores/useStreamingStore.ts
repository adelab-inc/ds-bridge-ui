import { create } from 'zustand';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';

interface StreamingState {
  /** 현재 스트리밍 중인 메시지 (null = 스트리밍 없음) */
  message: ChatMessage | null;

  /** 직접 값 설정 */
  setMessage: (msg: ChatMessage | null) => void;

  /** functional update (prev => next) */
  updateMessage: (
    updater: (prev: ChatMessage | null) => ChatMessage | null
  ) => void;
}

/**
 * 스트리밍 메시지 전용 Zustand 스토어
 *
 * React의 useState 대신 사용하여 배칭/동시성 렌더링에 의한
 * state 유실 문제를 방지합니다.
 */
export const useStreamingStore = create<StreamingState>((set, get) => ({
  message: null,

  setMessage: (msg) => set({ message: msg }),

  updateMessage: (updater) => set({ message: updater(get().message) }),
}));
