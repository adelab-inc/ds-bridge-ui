import { create } from 'zustand';
import type { CodeEvent } from '@/types/chat';

interface CodeGenerationState {
  // 상태
  generatedCode: CodeEvent | null;
  /** generatedCode가 속한 룸 ID — 룸 전환 시 화면/이름 불일치(오염) 방지용 */
  generatedRoomId: string | null;
  isGeneratingCode: boolean;
  /** 현재 생성 중인 룸 ID — 다른 룸에 "생성 중" 스피너가 새는 것 방지용 */
  generatingRoomId: string | null;

  // 액션
  setGeneratedCode: (code: CodeEvent | null, roomId: string | null) => void;
  setIsGeneratingCode: (isGenerating: boolean) => void;

  // 핸들러
  onStreamStart: (roomId: string) => void;
  onStreamEnd: () => void;
  onCodeGenerated: (code: CodeEvent, roomId: string) => void;

  // 리셋
  reset: () => void;
}

export const useCodeGenerationStore = create<CodeGenerationState>((set) => ({
  // 초기 상태
  generatedCode: null,
  generatedRoomId: null,
  isGeneratingCode: false,
  generatingRoomId: null,

  // 액션
  setGeneratedCode: (code, roomId) =>
    set({ generatedCode: code, generatedRoomId: roomId }),
  setIsGeneratingCode: (isGenerating) =>
    set({ isGeneratingCode: isGenerating }),

  // 핸들러
  onStreamStart: (roomId) =>
    set({
      generatedCode: null,
      generatedRoomId: null,
      isGeneratingCode: true,
      generatingRoomId: roomId,
    }),
  onStreamEnd: () => set({ isGeneratingCode: false }),
  onCodeGenerated: (code, roomId) =>
    set({
      generatedCode: code,
      generatedRoomId: roomId,
      isGeneratingCode: false,
    }),

  // 리셋
  reset: () =>
    set({
      generatedCode: null,
      generatedRoomId: null,
      isGeneratingCode: false,
      generatingRoomId: null,
    }),
}));
