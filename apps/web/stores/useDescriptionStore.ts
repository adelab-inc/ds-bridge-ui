import { create } from 'zustand';
import type {
  Description,
  DescriptionVersionSummary,
  EditHistory,
} from '@ds-hub/shared-types/typescript/database/description';

/** 디스크립션 UI 상태 */
export type DescriptionUiState =
  | 'idle'
  | 'viewing'
  | 'editing'
  | 'waiting'
  | 'history';

/** 디스크립션 탭 타입 */
export type DescriptionTab = 'design' | 'description';

interface DescriptionState {
  // UI 상태
  uiState: DescriptionUiState;
  activeTab: DescriptionTab;

  // 버전 관리
  versions: DescriptionVersionSummary[];
  currentVersion: number | null;
  currentContent: string | null;
  currentDescription: Description | null;

  // 편집
  editDraft: string | null;
  editHistory: EditHistory | null;

  // 로딩
  isExtracting: boolean;

  // 탭 액션
  setActiveTab: (tab: DescriptionTab) => void;

  // 상태 전이 액션
  setCurrentDescription: (description: Description) => void;
  startEditing: () => void;
  updateEditDraft: (content: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  openHistory: () => void;
  closeHistory: () => void;

  // 버전 관리 액션
  setVersions: (versions: DescriptionVersionSummary[]) => void;

  // 로딩 액션
  setIsExtracting: (isExtracting: boolean) => void;

  // 리셋
  reset: () => void;
}

const initialState = {
  uiState: 'idle' as DescriptionUiState,
  activeTab: 'design' as DescriptionTab,
  versions: [] as DescriptionVersionSummary[],
  currentVersion: null,
  currentContent: null,
  currentDescription: null,
  editDraft: null,
  editHistory: null,
  isExtracting: false,
};

export const useDescriptionStore = create<DescriptionState>((set, get) => ({
  ...initialState,

  // 탭 전환
  setActiveTab: (tab) => set({ activeTab: tab }),

  // 추출 완료 → viewing 상태 + 디스크립션 탭 자동 전환
  setCurrentDescription: (description) => {
    console.log('[DESC:setCurrentDescription]', {
      version: description.version,
      content: description.content?.slice(0, 80),
      edited_content: description.edited_content?.slice(0, 80),
      resolved: (description.edited_content ?? description.content)?.slice(0, 80),
    });
    set({
      uiState: 'viewing',
      activeTab: 'description',
      currentVersion: description.version,
      currentContent: description.edited_content ?? description.content,
      currentDescription: description,
      isExtracting: false,
    });
  },

  // viewing → editing 전환
  startEditing: () => {
    const { currentContent } = get();
    set({
      uiState: 'editing',
      editDraft: currentContent,
    });
  },

  // 편집 내용 업데이트
  updateEditDraft: (content) => set({ editDraft: content }),

  // 편집 저장 → waiting 상태 + 디자인 탭 전환
  saveEdit: () => {
    const { currentContent, editDraft, currentVersion } = get();
    console.log('[DESC:saveEdit]', {
      currentVersion,
      currentContent: currentContent?.slice(0, 80),
      editDraft: editDraft?.slice(0, 80),
    });
    if (!currentContent || !editDraft || !currentVersion) return;

    set({
      uiState: 'viewing',
      editHistory: {
        original_content: currentContent,
        edited_content: editDraft,
        base_version: currentVersion,
      },
      currentContent: editDraft,
      editDraft: null,
    });
  },

  // 편집 취소 → viewing 복귀
  cancelEdit: () =>
    set({
      uiState: 'viewing',
      editDraft: null,
    }),

  // 이력 패널 열기
  openHistory: () =>
    set({
      uiState: 'history',
      activeTab: 'description',
    }),

  // 이력 패널 닫기 → viewing 복귀
  closeHistory: () => set({ uiState: 'viewing' }),

  // 버전 목록 설정
  setVersions: (versions) => set({ versions }),

  // 추출 로딩 상태
  setIsExtracting: (isExtracting) => set({ isExtracting }),

  // 전체 리셋
  reset: () => set(initialState),
}));
