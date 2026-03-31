import type { ReactNode } from 'react';

// Grid Types (가이드 문서 Section 5)
export type GridType = 'A' | 'B' | 'C' | 'C-2' | 'D' | 'D-2' | 'E' | 'F' | 'G' | 'H';

export type ColumnSize = 2 | 3 | 4 | 6 | 8 | 9 | 12;

export interface GridTypeDefinition {
  type: GridType;
  columns: ColumnSize[]; // 합계 = 12
  label: string; // "col-6 + col-6"
  description: string; // 용도 설명
}

// Row Patterns (가이드 문서 Section 6)
export type RowPatternCode = 'RP-1' | 'RP-2' | 'RP-3' | 'RP-4' | 'RP-5' | 'RP-6' | 'RP-7' | 'RP-8';

/**
 * RowSlot 슬롯 ID (가이드 원문 용어 기반)
 *
 * - filter:     Filter Bar — 검색/필터 영역 (RP-1)
 * - actions:    Action Buttons — 버튼 영역 (RP-1, RP-3)
 * - grid:       Grid — 데이터 그리드 영역 (RP-1, RP-4, RP-5, RP-8)
 * - detail:     Detail View / Detail Area — 상세 정보 영역 (RP-2, RP-6)
 * - form:       Form Section — 입력 폼 영역 (RP-3)
 * - summary:    상단 요약 영역 — 요약 통계 영역 (RP-4)
 * - navigation: Navigation Area — 탐색/트리 영역 (RP-6)
 * - section:    Section A / Section B — 병렬 비교 영역 (RP-7)
 * - info:       상단 기본정보 — 기본 정보 표시 영역 (RP-8)
 * - tab:        Tab 영역 — 탭 전환 영역 (RP-8)
 */
export type SlotId =
  | 'filter'
  | 'actions'
  | 'grid'
  | 'detail'
  | 'form'
  | 'summary'
  | 'navigation'
  | 'section'
  | 'info'
  | 'tab';

// Section Column Context
export interface SectionColumnContextValue {
  columnSize: ColumnSize;
  gridType: GridType;
  sectionIndex: number;
}

// Component Props
export interface GridLayoutProps {
  type?: GridType; // default: 'A' (단일 영역형, 가이드 기본 화면 구조)
  children: ReactNode;
  className?: string;
  gap?: string;
}

export interface RowPatternProps {
  pattern?: RowPatternCode; // 미지정 시 간격만 기본값(20px) 적용, 검증 시 "RP 미지정" 감지 가능
  children: ReactNode;
  className?: string;
}

export interface RowSlotProps {
  slot: SlotId;
  children: ReactNode;
  className?: string;
}
