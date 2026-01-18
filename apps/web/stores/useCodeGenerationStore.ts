import { create } from 'zustand';
import type { CodeEvent } from '@/types/chat';

interface CodeGenerationState {
  // 상태
  generatedCode: CodeEvent | null;
  isGeneratingCode: boolean;

  // 액션
  setGeneratedCode: (code: CodeEvent | null) => void;
  setIsGeneratingCode: (isGenerating: boolean) => void;

  // 핸들러
  onStreamStart: () => void;
  onStreamEnd: () => void;
  onCodeGenerated: (code: CodeEvent) => void;

  // 리셋
  reset: () => void;
}

export const useCodeGenerationStore = create<CodeGenerationState>((set) => ({
  // 초기 상태
  generatedCode: null,
  isGeneratingCode: false,

  // 액션
  setGeneratedCode: (code) => set({ generatedCode: code }),
  setIsGeneratingCode: (isGenerating) => set({ isGeneratingCode: isGenerating }),

  // 핸들러
  onStreamStart: () => set({ generatedCode: null, isGeneratingCode: true }),
  onStreamEnd: () => set({ isGeneratingCode: false }),
  onCodeGenerated: (code) => set({ generatedCode: code, isGeneratingCode: false }),

  // 리셋
  reset: () => set({ generatedCode: null, isGeneratingCode: false }),
}));
