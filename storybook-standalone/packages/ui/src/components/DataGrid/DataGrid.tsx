// React 및 AG Grid 관련 필수 라이브러리 import
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../utils';
import { AgGridReact } from 'ag-grid-react';

// AG Grid 기본 CSS (아이콘 폰트 포함)
import 'ag-grid-community/styles/ag-grid.css';

// AG Grid v34 Theme API (Enterprise 기준)
import {
  ColDef,
  ColGroupDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
  CellClickedEvent,
  RowSelectedEvent,
  FilterChangedEvent,
  SortChangedEvent,
  CellValueChangedEvent,
  GridOptions,
  RowClassParams,
  GetRowIdParams,
  ValueFormatterParams,
  ICellRendererParams,
  ColumnMovedEvent,
  ModuleRegistry,
  themeQuartz,
  themeAlpine,
  themeBalham,
  Theme,
  AllEnterpriseModule,
} from 'ag-grid-enterprise';

// AG Grid Theme 타입 정의
type AgGridTheme = Theme;
type ThemeParams = Parameters<typeof themeQuartz.withParams>[0];

// Design Tokens import - packages/ui 토큰 시스템 사용
import { designTokens } from '../../tokens/design-tokens';

// AG Grid 모듈 등록 (v34 필수) - Enterprise 기능 포함
ModuleRegistry.registerModules([AllEnterpriseModule]);

/** 셀 세로 정렬 cva 변형 정의 */
const cellAlignVariants = cva('flex', {
  variants: {
    verticalAlign: {
      top: 'items-start',
      center: 'items-center',
      bottom: 'items-end',
    },
  },
  defaultVariants: {
    verticalAlign: 'center',
  },
});

export type CellVerticalAlign = NonNullable<VariantProps<typeof cellAlignVariants>['verticalAlign']>;

/**
 * AG Grid 한글 Locale 텍스트
 * Advanced Filter 및 기타 UI 요소 한글화
 */
const AG_GRID_LOCALE_KO = {
  // Advanced Filter
  advancedFilterContains: '포함',
  advancedFilterNotContains: '포함하지 않음',
  advancedFilterEquals: '같음',
  advancedFilterNotEqual: '같지 않음',
  advancedFilterStartsWith: '시작 문자',
  advancedFilterEndsWith: '끝 문자',
  advancedFilterBlank: '빈 값',
  advancedFilterNotBlank: '빈 값 아님',
  advancedFilterAnd: '그리고',
  advancedFilterOr: '또는',
  advancedFilterApply: '적용',
  advancedFilterBuilder: '필터 빌더',
  advancedFilterValidationMissingColumn: '컬럼이 없습니다',
  advancedFilterValidationMissingOption: '옵션이 없습니다',
  advancedFilterValidationMissingValue: '값이 없습니다',
  advancedFilterValidationInvalidColumn: '컬럼을 찾을 수 없습니다',
  advancedFilterValidationInvalidOption: '옵션을 찾을 수 없습니다',
  advancedFilterValidationMissingQuote: '값에 끝 따옴표가 없습니다',
  advancedFilterValidationNotANumber: '값이 숫자가 아닙니다',
  advancedFilterValidationInvalidDate: '값이 유효한 날짜가 아닙니다',
  advancedFilterValidationMissingCondition: '조건이 없습니다',
  advancedFilterValidationJoinOperatorMismatch: '조건 내 연결 연산자는 동일해야 합니다',
  advancedFilterValidationInvalidJoinOperator: '연결 연산자를 찾을 수 없습니다',
  advancedFilterValidationMissingEndBracket: '끝 괄호가 없습니다',
  advancedFilterValidationExtraEndBracket: '끝 괄호가 너무 많습니다',
  advancedFilterBuilderTitle: '고급 필터',
  advancedFilterBuilderApply: '적용',
  advancedFilterBuilderCancel: '취소',
  advancedFilterBuilderAddButtonTooltip: '필터 또는 그룹 추가',
  advancedFilterBuilderRemoveButtonTooltip: '제거',
  advancedFilterBuilderMoveUpButtonTooltip: '위로 이동',
  advancedFilterBuilderMoveDownButtonTooltip: '아래로 이동',
  advancedFilterBuilderAddJoin: '그룹 추가',
  advancedFilterBuilderAddCondition: '필터 추가',
  advancedFilterBuilderSelectColumn: '컬럼 선택',
  advancedFilterBuilderSelectOption: '옵션 선택',
  advancedFilterBuilderEnterValue: '값 입력...',
  advancedFilterBuilderValidationAlreadyApplied: '현재 필터가 이미 적용되었습니다.',
  advancedFilterBuilderValidationIncomplete: '모든 조건이 완료되지 않았습니다.',
  advancedFilterBuilderValidationSelectColumn: '컬럼을 선택해야 합니다.',
  advancedFilterBuilderValidationSelectOption: '옵션을 선택해야 합니다.',
  advancedFilterBuilderValidationEnterValue: '값을 입력해야 합니다.',

  // Filter Conditions
  filterOoo: '필터...',
  equals: '같음',
  notEqual: '같지 않음',
  lessThan: '보다 작음',
  greaterThan: '보다 큼',
  lessThanOrEqual: '작거나 같음',
  greaterThanOrEqual: '크거나 같음',
  inRange: '범위 내',
  inRangeStart: '시작',
  inRangeEnd: '끝',
  contains: '포함',
  notContains: '포함하지 않음',
  startsWith: '시작 문자',
  endsWith: '끝 문자',
  blank: '빈 값',
  notBlank: '빈 값 아님',
  before: '이전',
  after: '이후',
  andCondition: '그리고',
  orCondition: '또는',

  // Filter Buttons
  applyFilter: '적용',
  resetFilter: '초기화',
  clearFilter: '지우기',
  cancelFilter: '취소',

  // Column Menu
  pinColumn: '컬럼 고정',
  pinLeft: '왼쪽 고정',
  pinRight: '오른쪽 고정',
  noPin: '고정 해제',
  autosizeThisColumn: '이 컬럼 자동 크기',
  autosizeAllColumns: '모든 컬럼 자동 크기',
  resetColumns: '컬럼 초기화',

  // Pagination (Figma 디자인 기준: "총 X개 중 Y-Z행" + "페이지 당 항목")
  // Row Summary 형식: 총 [totalRows]개 중 [firstRow]-[lastRow]행
  // "총"과 "행"은 CSS ::before, ::after로 추가
  page: '',
  more: '더보기',
  to: '-', // 범위 구분자 (1-20)
  of: '개 중', // Row Summary: "20 개 중 8618" → CSS로 순서 조정 필요
  next: '',
  last: '',
  first: '',
  previous: '',
  loadingOoo: '로딩 중...',
  pageSizeSelectorLabel: '페이지 당 항목',
  ariaPageSizeSelectorLabel: '페이지 당 항목',

  // Selection
  selectAll: '전체 선택',
  selectAllSearchResults: '검색 결과 전체 선택',
  searchOoo: '검색...',
  noRowsToShow: '표시할 데이터가 없습니다',
  enabled: '사용',

  // Row Grouping
  group: '그룹',
  groups: '그룹들',
  pivot: '피벗',
  pivotMode: '피벗 모드',
  rowGroupColumns: '행 그룹 컬럼',
  rowGroupColumnsEmptyMessage: '여기로 컬럼을 드래그하세요',
  valueColumns: '값 컬럼',
  valueColumnsEmptyMessage: '집계할 컬럼을 드래그하세요',

  // Aggregation
  sum: '합계',
  min: '최소',
  max: '최대',
  count: '개수',
  avg: '평균',
};

/**
 * AG Grid 커스텀 테마 - Design Tokens 기반
 * packages/ui/src/tokens/design-tokens.ts의 토큰을 AG Grid Theme API에 직접 매핑
 * @see https://www.figma.com/design/m3MKIEBXCXtj4HCdJd2zS6/WSR?node-id=6105-56008
 */
export const aplusGridTheme = themeQuartz.withParams({
  // === Colors: Background ===
  backgroundColor: designTokens.colors['bg-surface'], // #ffffff
  headerBackgroundColor: designTokens.colors['bg-canvas'], // #f4f6f8 - Figma 헤더 배경
  oddRowBackgroundColor: designTokens.colors['bg-surface'],
  rowHoverColor: designTokens.colors['state-overlay-on-neutral-hover'],
  selectedRowBackgroundColor: designTokens.colors['bg-selection'],
  modalOverlayBackgroundColor: designTokens.colors['overlay-scrim'],

  // === Colors: Border ===
  borderColor: '#0000001f', // Figma: rgba(0,0,0,0.12) - 테이블 테두리
  columnBorder: false, // 셀 사이 세로선 없음
  headerColumnBorder: true, // 헤더에만 세로선 있음
  headerColumnBorderHeight: '50%', // 헤더 세로선 높이 (Figma 기준)

  // === Colors: Text ===
  foregroundColor: designTokens.colors['text-primary'], // #212529
  headerTextColor: designTokens.colors['text-primary'], // #212529
  textColor: designTokens.colors['text-primary'],
  subtleTextColor: designTokens.colors['text-secondary'],

  // === Colors: Accent ===
  accentColor: designTokens.colors['brand-primary'],

  // === Colors: Input ===
  inputBackgroundColor: designTokens.colors['bg-surface'],
  inputBorder: '#0000001f', // Figma: rgba(0,0,0,0.12)
  inputDisabledBackgroundColor: designTokens.colors['field-bg-disabled'],

  // === Colors: Checkbox ===
  checkboxCheckedBackgroundColor: designTokens.colors['control-bg-on'],
  checkboxUncheckedBackgroundColor: designTokens.colors['bg-surface'],
  checkboxUncheckedBorderColor: designTokens.colors['control-stroke-default'], // #ced4da

  // === Colors: Icon ===
  iconColor: designTokens.colors['icon-interactive-default'], // #495057

  // === Colors: Invalid ===
  invalidColor: designTokens.colors['semantic-error'],

  // === Spacing & Sizing (Figma 기준) ===
  cellHorizontalPadding: 12, // size/cellHorizontalPadding
  cellWidgetSpacing: 10, // size/cellWidgetSpacing
  rowHeight: 40, // size/rowHeight
  headerHeight: 42, // size/headerHeight
  spacing: 8, // size/spacing
  wrapperBorderRadius: 8, // size/borderRadius
  borderRadius: 6, // size/inputBorderRadius

  // === Typography (Figma 기준) ===
  fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: 14, // size/dataFontSize - 테이블 셀 텍스트
  headerFontSize: 14, // size/headerFontSize - 테이블 헤더
  headerFontWeight: 500, // font/weight/medium

  // === Icons ===
  iconSize: 16,

  // === Advanced Filter ===
  advancedFilterBuilderButtonBarBorder: true,
  advancedFilterBuilderIndentSize: 20,
  advancedFilterBuilderJoinPillColor: '#6366f1',
  advancedFilterBuilderColumnPillColor: '#e0f2fe',
  advancedFilterBuilderOptionPillColor: '#fef3c7',
  advancedFilterBuilderValuePillColor: designTokens.colors['bg-surface'],
});

/**
 * AG Grid 다크 테마 - 스크린샷 기반 커스텀 다크 테마
 * 진한 네이비 배경에 밝은 텍스트, 세련된 UI
 */
export const aplusDarkGridTheme = themeQuartz.withParams({
  // === Colors: Background ===
  backgroundColor: '#1e2433',
  headerBackgroundColor: '#1e2433',
  oddRowBackgroundColor: '#1e2433',
  rowHoverColor: '#2a3142',
  selectedRowBackgroundColor: '#3d4a5c',
  modalOverlayBackgroundColor: 'rgba(0, 0, 0, 0.5)',

  // === Colors: Border ===
  borderColor: '#3d4a5c',
  columnBorder: true,
  headerColumnBorder: true,
  headerColumnBorderHeight: '50%',

  // === Colors: Text ===
  foregroundColor: '#e8eaed',
  headerTextColor: '#9ca3af',
  textColor: '#e8eaed',
  subtleTextColor: '#9ca3af',

  // === Colors: Accent ===
  accentColor: '#60a5fa',

  // === Colors: Input ===
  inputBackgroundColor: '#2a3142',
  inputBorder: true,
  inputDisabledBackgroundColor: '#252d3d',

  // === Colors: Checkbox ===
  checkboxCheckedBackgroundColor: '#60a5fa',
  checkboxCheckedBorderColor: '#60a5fa',
  checkboxCheckedShapeColor: '#ffffff',
  checkboxUncheckedBackgroundColor: 'transparent',
  checkboxUncheckedBorderColor: '#6b7280',
  checkboxIndeterminateBackgroundColor: '#60a5fa',

  // === Colors: Toggle Button ===
  toggleButtonOffBackgroundColor: '#3d4a5c',
  toggleButtonOnBackgroundColor: '#60a5fa',

  // === Colors: Invalid ===
  invalidColor: '#ef4444',

  // === Spacing & Sizing ===
  cellHorizontalPadding: 16,
  rowHeight: 56,
  headerHeight: 48,
  spacing: 8,
  wrapperBorderRadius: 8,
  borderRadius: 4,

  // === Typography ===
  fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: 14,
  headerFontSize: 13,
  headerFontWeight: 500,

  // === Icons ===
  iconSize: 16,

  // === Advanced Filter ===
  advancedFilterBuilderButtonBarBorder: true,
  advancedFilterBuilderIndentSize: 20,
  advancedFilterBuilderJoinPillColor: '#60a5fa',
  advancedFilterBuilderColumnPillColor: '#374151',
  advancedFilterBuilderOptionPillColor: '#374151',
  advancedFilterBuilderValuePillColor: '#2a3142',
});

/**
 * 사전 정의된 테마 프리셋
 * 'aplus' - Design Tokens 기반 커스텀 테마 (기본값)
 * 'aplusDark' - 다크 테마 (네이비 배경)
 * 'quartz' - AG Grid Quartz 테마
 * 'alpine' - AG Grid Alpine 테마
 * 'balham' - AG Grid Balham 테마
 */
export const GRID_THEMES = {
  aplus: aplusGridTheme,
  aplusDark: aplusDarkGridTheme,
  quartz: themeQuartz,
  alpine: themeAlpine,
  balham: themeBalham,
} as const;

export type GridThemePreset = keyof typeof GRID_THEMES;

/**
 * 커스텀 테마 생성 헬퍼 함수
 * 기본 테마에 사용자 정의 파라미터를 오버라이드합니다
 *
 * @param baseTheme - 기본 테마 프리셋 ('aplus' | 'quartz' | 'alpine' | 'balham')
 * @param params - 오버라이드할 테마 파라미터
 * @returns 커스텀 AG Grid 테마
 *
 * @example
 * const myTheme = createGridTheme('aplus', {
 *   accentColor: '#ff0000',
 *   rowHeight: 48,
 *   headerBackgroundColor: '#f0f0f0',
 * });
 */
export const createGridTheme = (
  baseTheme: GridThemePreset = 'aplus',
  params?: ThemeParams
): AgGridTheme => {
  const base = GRID_THEMES[baseTheme];
  if (!params) return base;
  return base.withParams(params);
};

/**
 * Advanced Filter 커스텀 CSS ID
 */
const ADVANCED_FILTER_STYLE_ID = 'ag-grid-advanced-filter-styles';

/**
 * Pagination Footer 커스텀 CSS ID
 */
const PAGINATION_STYLE_ID = 'ag-grid-pagination-styles';

/**
 * Aplus Theme 기본 CSS ID
 */
const APLUS_THEME_STYLE_ID = 'ag-grid-aplus-theme-styles';

/**
 * Aplus Theme 기본 CSS 생성 함수
 * Figma 디자인 기준: 헤더 42px, 행 40px, Pretendard 폰트
 * @see https://www.figma.com/design/m3MKIEBXCXtj4HCdJd2zS6/WSR?node-id=6105-57821
 */
const getAplusThemeStyles = () => `
  /* ========================================
   * Aplus Theme - Figma 디자인 기준 스타일
   * 높이는 gridOptions에서 설정 (rowHeight, headerHeight)
   * ======================================== */

  /* Column Menu Icon - hide-column-menu 클래스가 있으면 숨김 */
  .hide-column-menu .ag-header-cell-menu-button {
    display: none !important;
  }

  /* Header Background & Border */
  .ag-header {
    background-color: #f4f6f8 !important;
  }

  .ag-header-cell {
    background-color: #f4f6f8 !important;
  }

  /* Header Text Style */
  .ag-header-cell-text {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    color: #212529 !important;
  }

  /* Cell Text Style */
  .ag-cell {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    color: #212529 !important;
  }

  /* 숫자 셀 Tabular Nums - 자릿수 정렬을 위한 고정 등폭 숫자 */
  .ag-right-aligned-cell {
    font-variant-numeric: tabular-nums !important;
  }

  /* 중앙 정렬 셀/헤더 */
  .ag-center-aligned-cell {
    text-align: center !important;
  }
  .ag-center-aligned-header .ag-header-cell-label {
    justify-content: center !important;
  }

  /* Row Number 컬럼 - 셀과 동일한 배경색 (헤더 색상이 아닌 흰색) */
  .ag-row .ag-cell.ag-row-number-cell {
    background-color: ${designTokens.colors['bg-surface']} !important;
  }

  /* 합계칸 (pinnedBottom) - 헤더와 동일한 배경색, 셀과 동일한 폰트 */
  .ag-floating-bottom .ag-row {
    background-color: ${designTokens.colors['bg-canvas']} !important;
    font-weight: 400 !important;
  }
  .ag-floating-bottom .ag-row .ag-cell {
    background-color: ${designTokens.colors['bg-canvas']} !important;
  }

  /* 유효성 검사 탈락 셀 - 2px inset 보더 */
  .ag-cell.ag-cell-invalid {
    box-shadow: inset 0 0 0 2px ${designTokens.colors['semantic-error']} !important;
  }

  /* Checkbox Column */
  .ag-cell-wrapper {
    align-items: center !important;
  }

  .ag-selection-checkbox {
    margin-right: 0 !important;
  }

  /* Checkbox 스타일 - 커스텀 체크박스 */
  .ag-checkbox-input-wrapper {
    width: 16px !important;
    height: 16px !important;
    position: relative !important;
    background: #ffffff !important;
    border: 1px solid #ced4da !important;
    border-radius: 3px !important;
    cursor: pointer !important;
  }

  .ag-checkbox-input-wrapper input[type="checkbox"] {
    width: 16px !important;
    height: 16px !important;
    opacity: 0 !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    cursor: pointer !important;
    margin: 0 !important;
    z-index: 10 !important;
  }

  /* 체크된 상태 - 검정 배경 + 흰색 체크마크 */
  .ag-checkbox-input-wrapper.ag-checked {
    background: #000000 !important;
    border-color: #000000 !important;
  }

  .ag-checkbox-input-wrapper.ag-checked::after {
    content: '✓' !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    position: absolute !important;
    inset: 0 !important;
    color: #ffffff !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    line-height: 1 !important;
  }

  /* Indeterminate 상태 */
  .ag-checkbox-input-wrapper.ag-indeterminate {
    background: #000000 !important;
    border-color: #000000 !important;
  }

  .ag-checkbox-input-wrapper.ag-indeterminate::after {
    content: '−' !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    position: absolute !important;
    inset: 0 !important;
    color: #ffffff !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    line-height: 1 !important;
  }

  /* 미체크 상태 - 아이콘 숨김 */
  .ag-checkbox-input-wrapper:not(.ag-checked):not(.ag-indeterminate)::after {
    display: none !important;
  }

  /* AG Grid 기본 아이콘 숨김 */
  .ag-checkbox-input-wrapper .ag-icon {
    display: none !important;
  }

  /* Header Checkbox */
  .ag-header-select-all .ag-checkbox-input-wrapper {
    width: 16px !important;
    height: 16px !important;
  }

  /* Scrollbar Styles */
  .ag-body-horizontal-scroll,
  .ag-body-vertical-scroll {
    background-color: #f4f6f8 !important;
  }

  .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
  .ag-body-vertical-scroll-viewport::-webkit-scrollbar {
    width: 18px !important;
    height: 18px !important;
  }

  .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
  .ag-body-vertical-scroll-viewport::-webkit-scrollbar-track {
    background: transparent !important;
  }

  .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
  .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2) !important;
    border-radius: 9px !important;
    border: 4px solid transparent !important;
    background-clip: content-box !important;
  }

  .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover,
  .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb:hover {
    background-color: rgba(0, 0, 0, 0.35) !important;
  }
`;

/**
 * Pagination Footer 커스텀 CSS 생성 함수
 * Figma 디자인 기준: "총 X개 중 Y-Z행" + "페이지 당 항목" 형식
 * @see https://www.figma.com/design/m3MKIEBXCXtj4HCdJd2zS6/WSR?node-id=6105-58384
 */
const getPaginationStyles = () => `
  /* ========================================
   * AG Grid Pagination Footer - Figma 디자인 기준
   * Layout: [총 X개 중 Y-Z행] .......... [페이지 당 항목 dropdown] [<< < X/Y > >>]
   * ======================================== */
  .ag-paging-panel {
    height: 42px !important;
    min-height: 42px !important;
    padding: 0 12px !important;
    border-top: 1px solid rgba(0, 0, 0, 0.12) !important;
    background-color: #ffffff !important;
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    color: #212529 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
  }

  /* ========================================
   * 왼쪽: Row Summary (총 X개 중 Y-Z행)
   * AG Grid 기본 형식: [firstRow] to [lastRow] of [totalRows]
   * Figma 형식: 총 [totalRows]개 중 [firstRow]-[lastRow]행
   *
   * 현재 표시: 총 1-20 개 중 8,618 행
   * (순서 변경은 AG Grid 내부 구조상 CSS만으로 어려움)
   * ======================================== */
  .ag-paging-row-summary-panel {
    display: flex !important;
    align-items: center !important;
    gap: 2px !important;
    font-size: 14px !important;
    color: #212529 !important;
    order: -1 !important;
    flex: 1 !important;
    padding-right: 38px !important;
  }

  /* "총" 텍스트를 앞에 추가 */
  .ag-paging-row-summary-panel::before {
    content: '총 ' !important;
    font-weight: 400 !important;
  }

  /* 숫자 Bold 처리 */
  .ag-paging-row-summary-panel-number {
    font-weight: 700 !important;
    color: #212529 !important;
  }

  /* "행" 텍스트를 뒤에 추가 */
  .ag-paging-row-summary-panel::after {
    content: '행' !important;
    font-weight: 400 !important;
    margin-left: 2px !important;
  }

  /* ========================================
   * 오른쪽: Page Size Selector (페이지 당 항목)
   * ======================================== */
  .ag-paging-page-size {
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    margin-right: 38px !important;
  }

  /* 페이지 당 항목 라벨 스타일 */
  .ag-paging-page-size-label {
    font-size: 14px !important;
    color: #212529 !important;
    white-space: nowrap !important;
  }

  /* 드롭다운 스타일 */
  .ag-paging-page-size .ag-picker-field-wrapper {
    height: 28px !important;
    min-width: 120px !important;
    width: 184px !important;
    border: 1px solid rgba(0, 0, 0, 0.12) !important;
    border-radius: 6px !important;
    background-color: #ffffff !important;
    padding-left: 8px !important;
  }

  .ag-paging-page-size .ag-picker-field-display {
    font-size: 13px !important;
    color: #212529 !important;
    line-height: 24px !important;
  }

  .ag-paging-page-size .ag-picker-field-icon {
    width: 16px !important;
    height: 16px !important;
    margin-right: 8px !important;
  }

  /* ========================================
   * 오른쪽: Page Summary (X / Y 페이지)
   * ======================================== */
  .ag-paging-page-summary-panel {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
  }

  .ag-paging-number {
    font-weight: 700 !important;
    color: #212529 !important;
    font-size: 14px !important;
  }

  .ag-paging-description {
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    font-size: 14px !important;
  }

  /* ========================================
   * Navigation Buttons (처음, 이전, 다음, 마지막)
   * ======================================== */
  .ag-paging-button-wrapper {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
  }

  .ag-paging-button {
    width: 16px !important;
    height: 16px !important;
    cursor: pointer !important;
    opacity: 0.7 !important;
    transition: opacity 0.15s !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  .ag-paging-button:hover {
    opacity: 1 !important;
  }

  .ag-paging-button.ag-disabled {
    opacity: 0.3 !important;
    cursor: default !important;
  }

  /* 네비게이션 버튼 아이콘 */
  .ag-paging-button .ag-icon {
    font-size: 16px !important;
  }

  /* ========================================
   * Layout Reordering for Figma Design
   * 순서: row-summary(좌) | page-size(우) | page-summary(우)
   * ======================================== */
  .ag-paging-panel > * {
    flex-shrink: 0 !important;
  }

  /* Hide default text separators */
  .ag-paging-panel > span:not([class]) {
    display: none !important;
  }

  /* 페이지 크기 셀렉터와 페이지 번호 사이 간격 */
  .ag-paging-page-summary-panel {
    margin-left: 0 !important;
  }
`;

/**
 * Advanced Filter 커스텀 CSS 생성 함수
 * AG Grid 공식 예제 디자인을 참조하여 깔끔한 UI 제공
 */
const getAdvancedFilterStyles = () => `
  /* ========================================
   * Advanced Filter Header (인라인 필터 바)
   * ======================================== */
  .ag-advanced-filter {
    min-height: 48px !important;
    padding: 8px 16px !important;
    background-color: #ffffff !important;
    border-bottom: 1px solid #e2e8f0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
  }

  .ag-advanced-filter-header-cell {
    background-color: transparent !important;
  }

  /* 필터 입력 영역 */
  .ag-advanced-filter .ag-text-field-input {
    border: 1px solid #e2e8f0 !important;
    border-radius: 4px !important;
    padding: 8px 12px !important;
    font-size: 14px !important;
    background-color: #ffffff !important;
  }

  .ag-advanced-filter .ag-text-field-input:focus {
    border-color: #94a3b8 !important;
    outline: none !important;
  }

  /* Apply 버튼 */
  .ag-advanced-filter .ag-advanced-filter-apply-button,
  .ag-filter-apply-panel-button[data-ref="applyFilterButton"] {
    background-color: #e2e8f0 !important;
    color: #475569 !important;
    border: none !important;
    border-radius: 4px !important;
    padding: 8px 16px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    transition: background-color 0.15s !important;
    min-width: 80px !important;
    white-space: nowrap !important;
  }

  .ag-advanced-filter .ag-advanced-filter-apply-button:hover,
  .ag-filter-apply-panel-button[data-ref="applyFilterButton"]:hover {
    background-color: #cbd5e1 !important;
  }

  .ag-filter-apply-panel {
    min-width: 180px !important;
  }

  /* Builder 버튼 */
  .ag-advanced-filter .ag-advanced-filter-builder-button {
    background-color: #ffffff !important;
    color: #475569 !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 4px !important;
    padding: 8px 16px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    transition: all 0.15s !important;
  }

  .ag-advanced-filter .ag-advanced-filter-builder-button:hover {
    background-color: #f8fafc !important;
    border-color: #cbd5e1 !important;
  }

  /* ========================================
   * Advanced Filter Builder (팝업 다이얼로그)
   * ======================================== */
  .ag-advanced-filter-builder-wrapper {
    min-height: 280px !important;
    max-height: 480px !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12) !important;
    overflow: hidden !important;
    border: 1px solid #e2e8f0 !important;
  }

  .ag-advanced-filter-builder {
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    height: 100% !important;
    background-color: #ffffff !important;
  }

  /* Builder 타이틀 영역 */
  .ag-advanced-filter-builder-title-bar {
    padding: 12px 16px !important;
    background-color: #ffffff !important;
    border-bottom: 1px solid #e2e8f0 !important;
    font-weight: 600 !important;
    font-size: 14px !important;
    color: #1e293b !important;
  }

  /* ========================================
   * Virtual List (조건 목록 영역)
   * ======================================== */
  .ag-advanced-filter-builder-virtual-list-container {
    padding: 12px 16px !important;
    flex: 1 !important;
    overflow-y: auto !important;
  }

  .ag-advanced-filter-builder-virtual-list-item {
    padding: 4px 0 !important;
  }

  /* ========================================
   * Builder Item (각 조건 행)
   * ======================================== */
  .ag-advanced-filter-builder-item {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 6px 0 !important;
    min-height: 36px !important;
  }

  .ag-advanced-filter-builder-item-wrapper {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
  }

  /* ========================================
   * Pill 공통 스타일
   * ======================================== */
  .ag-advanced-filter-builder-pill {
    display: inline-flex !important;
    align-items: center !important;
    padding: 4px 12px !important;
    border-radius: 4px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
    white-space: nowrap !important;
  }

  /* Join Pill (그리고/또는) - AG Grid 공식 스타일 */
  .ag-advanced-filter-builder-join-pill,
  .ag-advanced-filter-builder-item-tree-line-vertical + .ag-advanced-filter-builder-pill-wrapper .ag-picker-field {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
    color: white !important;
    font-weight: 600 !important;
    padding: 5px 14px !important;
    border-radius: 20px !important;
    font-size: 12px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.3px !important;
    box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3) !important;
  }

  .ag-advanced-filter-builder-join-pill:hover {
    box-shadow: 0 4px 8px rgba(99, 102, 241, 0.4) !important;
    transform: translateY(-1px) !important;
  }

  /* Column Pill (컬럼 선택) */
  .ag-advanced-filter-builder-column-pill,
  .ag-advanced-filter-builder-item-condition .ag-picker-field:first-of-type {
    background-color: #e0f2fe !important;
    color: #0369a1 !important;
    padding: 5px 12px !important;
    border-radius: 4px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    border: 1px solid #bae6fd !important;
  }

  .ag-advanced-filter-builder-column-pill:hover {
    background-color: #bae6fd !important;
    border-color: #7dd3fc !important;
  }

  /* Option Pill (포함, 같음 등) */
  .ag-advanced-filter-builder-option-pill,
  .ag-advanced-filter-builder-item-condition .ag-picker-field:nth-of-type(2) {
    background-color: #fef3c7 !important;
    color: #92400e !important;
    padding: 5px 12px !important;
    border-radius: 4px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    border: 1px solid #fde68a !important;
  }

  .ag-advanced-filter-builder-option-pill:hover {
    background-color: #fde68a !important;
    border-color: #fcd34d !important;
  }

  /* Value Pill (값 입력) */
  .ag-advanced-filter-builder-value-pill,
  .ag-advanced-filter-builder-value-input {
    background-color: #ffffff !important;
    border: 1px solid #e2e8f0 !important;
    color: #1e293b !important;
    padding: 5px 12px !important;
    border-radius: 4px !important;
    font-size: 13px !important;
    min-width: 100px !important;
  }

  .ag-advanced-filter-builder-value-pill:hover,
  .ag-advanced-filter-builder-value-input:hover {
    border-color: #94a3b8 !important;
  }

  .ag-advanced-filter-builder-value-input:focus {
    outline: none !important;
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
  }

  /* ========================================
   * Picker Field (드롭다운 셀렉트)
   * ======================================== */
  .ag-advanced-filter-builder .ag-picker-field {
    min-height: 32px !important;
  }

  .ag-advanced-filter-builder .ag-picker-field-wrapper {
    border-radius: 4px !important;
    transition: all 0.15s ease !important;
  }

  .ag-advanced-filter-builder .ag-picker-field-display {
    padding: 5px 12px !important;
  }

  /* ========================================
   * Item 액션 버튼 (추가/삭제/이동)
   * ======================================== */
  .ag-advanced-filter-builder-item-button {
    width: 28px !important;
    height: 28px !important;
    border-radius: 4px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: #64748b !important;
    transition: all 0.15s ease !important;
  }

  .ag-advanced-filter-builder-item-button:hover {
    background-color: #f1f5f9 !important;
    color: #3b82f6 !important;
  }

  /* 추가 버튼 특별 스타일 */
  .ag-advanced-filter-builder-add-button-label {
    color: #3b82f6 !important;
    font-weight: 500 !important;
    font-size: 13px !important;
  }

  /* ========================================
   * Tree Line (들여쓰기 연결선)
   * ======================================== */
  .ag-advanced-filter-builder-item-tree-line-vertical,
  .ag-advanced-filter-builder-item-tree-line-horizontal {
    border-color: #e2e8f0 !important;
  }

  /* ========================================
   * 하단 버튼바 (적용/취소)
   * ======================================== */
  .ag-advanced-filter-builder-button-bar {
    display: flex !important;
    justify-content: flex-end !important;
    gap: 8px !important;
    padding: 12px 16px !important;
    background-color: #f8fafc !important;
    border-top: 1px solid #e2e8f0 !important;
  }

  .ag-advanced-filter-builder-button-bar button {
    padding: 8px 20px !important;
    border-radius: 4px !important;
    font-weight: 500 !important;
    font-size: 13px !important;
    transition: all 0.15s ease !important;
    cursor: pointer !important;
  }

  /* 적용 버튼 */
  .ag-advanced-filter-builder-apply-button {
    background-color: #e2e8f0 !important;
    color: #475569 !important;
    border: none !important;
  }

  .ag-advanced-filter-builder-apply-button:hover {
    background-color: #cbd5e1 !important;
  }

  .ag-advanced-filter-builder-apply-button:disabled {
    background: #f1f5f9 !important;
    color: #94a3b8 !important;
  }

  /* 취소 버튼 */
  .ag-advanced-filter-builder-cancel-button {
    background-color: #ffffff !important;
    color: #475569 !important;
    border: 1px solid #e2e8f0 !important;
  }

  .ag-advanced-filter-builder-cancel-button:hover {
    background-color: #f8fafc !important;
    border-color: #cbd5e1 !important;
  }

  /* ========================================
   * 팝업 리스트 (드롭다운)
   * ======================================== */
  .ag-popup-child {
    border-radius: 4px !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
    overflow: hidden !important;
    border: 1px solid #e2e8f0 !important;
  }

  .ag-list-item {
    padding: 8px 12px !important;
    font-size: 13px !important;
    transition: background-color 0.1s ease !important;
  }

  .ag-list-item:hover {
    background-color: #f8fafc !important;
  }

  .ag-list-item.ag-active-item {
    background-color: #f1f5f9 !important;
    color: #1e293b !important;
  }

  /* ========================================
   * 검증 에러 메시지
   * ======================================== */
  .ag-advanced-filter-builder-validation {
    color: #ef4444 !important;
    font-size: 12px !important;
    padding: 8px 16px !important;
    background-color: #fef2f2 !important;
    border-top: 1px solid #fecaca !important;
  }
`;

/**
 * 기본 셀 렌더러 컴포넌트들
 */

/**
 * 버튼 셀 렌더러 - 그리드 셀에 클릭 가능한 버튼을 렌더링합니다
 * @param props - AG Grid 셀 렌더러 props와 추가 onClick 핸들러
 */
export const ButtonCellRenderer: React.FC<ICellRendererParams & { onClick?: (data: any) => void }> = props => {
  // 버튼 클릭 핸들러
  const handleClick = () => {
    if ((props as any).onClick) {
      (props as any).onClick(props.data);
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        padding: '4px 8px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      {props.value || '클릭'}
    </button>
  );
};

/**
 * 체크박스 셀 렌더러 - 그리드 셀에 체크박스를 렌더링합니다
 * @param props - AG Grid 셀 렌더러 props와 추가 체크박스 변경 핸들러
 */
export const CheckboxCellRenderer: React.FC<
  ICellRendererParams & { onCheckboxChange?: (data: any, checked: boolean) => void }
> = props => {
  return (
    <input
      type="checkbox"
      checked={props.value}
      onChange={e => {
        if ((props as any).onCheckboxChange) {
          (props as any).onCheckboxChange(props.data, e.target.checked);
        }
      }}
    />
  );
};

/**
 * 이미지 셀 렌더러 - 그리드 셀에 이미지를 렌더링합니다
 * @param props - AG Grid 셀 렌더러 props
 */
export const ImageCellRenderer: React.FC<ICellRendererParams> = props => {
  return (
    <img
      src={props.value}
      alt="cell image"
      style={{
        width: '30px',
        height: '30px',
        objectFit: 'cover',
        borderRadius: '4px',
      }}
    />
  );
};

/**
 * Badge 셀 렌더러 - 상태 정보를 Badge(subtle) 컴포넌트로 표시합니다
 *
 * @example
 * // columnDefs에서 사용
 * { field: 'status', cellRenderer: BadgeCellRenderer }
 *
 * // 데이터: { status: 'success' } → 초록색 뱃지 "success"
 * // 커스텀 라벨 매핑은 cellRendererParams로 전달
 * {
 *   field: 'status',
 *   cellRenderer: BadgeCellRenderer,
 *   cellRendererParams: {
 *     labelMap: { approved: '승인', rejected: '거절', pending: '대기' },
 *     statusMap: { approved: 'success', rejected: 'error', pending: 'warning' },
 *     appearance: 'subtle', // 'solid' | 'subtle' (기본: 'subtle')
 *   }
 * }
 */
export type BadgeCellRendererParams = {
  /** 값 → 표시 라벨 매핑 (미지정 시 값 그대로 표시) */
  labelMap?: Record<string, string>;
  /** 값 → Badge status 매핑 (미지정 시 값 자체를 status로 사용) */
  statusMap?: Record<string, 'info' | 'success' | 'warning' | 'error'>;
  /** Badge appearance (기본: 'subtle') */
  appearance?: 'solid' | 'subtle';
};

const VALID_STATUSES = new Set(['info', 'success', 'warning', 'error']);

export const BadgeCellRenderer: React.FC<ICellRendererParams & BadgeCellRendererParams> = props => {
  const { value, labelMap, statusMap, appearance = 'subtle' } = props as ICellRendererParams & BadgeCellRendererParams;
  if (value == null || value === '') return <span style={{ display: 'flex', justifyContent: 'center' }}>-</span>;

  const stringValue = String(value);
  const label = labelMap?.[stringValue] ?? stringValue;
  const status = statusMap?.[stringValue] ?? (VALID_STATUSES.has(stringValue) ? stringValue : 'info');

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: '100%' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '12px',
          lineHeight: '16px',
          fontWeight: 400,
          backgroundColor: designTokens.colors[`badge-status-${status}-subtle-bg` as keyof typeof designTokens.colors]
            || designTokens.colors['badge-status-info-subtle-bg'],
          color: designTokens.colors[`badge-status-${status}-subtle-text` as keyof typeof designTokens.colors]
            || designTokens.colors['badge-status-info-subtle-text'],
          ...(appearance === 'solid' ? {
            backgroundColor: designTokens.colors[`bg-semantic-${status}` as keyof typeof designTokens.colors]
              || designTokens.colors['brand-primary'],
            color: '#ffffff',
          } : {}),
        }}
      >
        {label}
      </span>
    </span>
  );
};

/**
 * 증감 셀 렌더러 - 수치의 상승/하락을 컬러와 기호(▲▼)로 표시합니다
 * 색각 이상자 배려를 위해 반드시 기호를 동반합니다.
 *
 * @example
 * // columnDefs에서 사용
 * { field: 'profit', cellRenderer: TrendCellRenderer }
 *
 * // 데이터: { profit: 1500 } → "▲ 1,500" (빨간색)
 * // 데이터: { profit: -300 } → "▼ 300" (청록색)
 * // 데이터: { profit: 0 } → "0" (기본 색상)
 *
 * // 커스텀 옵션
 * {
 *   field: 'profit',
 *   cellRenderer: TrendCellRenderer,
 *   cellRendererParams: {
 *     showSign: true,        // +/- 기호도 함께 표시 (기본: false)
 *     formatNumber: true,    // 천단위 콤마 (기본: true)
 *     suffix: '%',           // 값 뒤에 붙일 접미사
 *     zeroDisplay: '-',      // 0일 때 표시할 문자 (기본: '0')
 *   }
 * }
 */
export type TrendCellRendererParams = {
  /** +/- 기호 함께 표시 여부 (기본: false, ▲▼ 기호는 항상 표시) */
  showSign?: boolean;
  /** 천단위 콤마 포맷 (기본: true) */
  formatNumber?: boolean;
  /** 값 뒤에 붙일 접미사 (예: '%', '원') */
  suffix?: string;
  /** 0일 때 표시할 문자 (기본: '0') */
  zeroDisplay?: string;
};

export const TrendCellRenderer: React.FC<ICellRendererParams & TrendCellRendererParams> = props => {
  const {
    value,
    showSign = false,
    formatNumber = true,
    suffix = '',
    zeroDisplay = '0',
  } = props as ICellRendererParams & TrendCellRendererParams;

  if (value == null || value === '') return <span style={{ display: 'flex', justifyContent: 'flex-end' }}>-</span>;

  const numValue = Number(value);
  if (isNaN(numValue)) return <span style={{ display: 'flex', justifyContent: 'flex-end' }}>{value}</span>;

  // 0인 경우
  if (numValue === 0) {
    return (
      <span style={{ display: 'flex', justifyContent: 'flex-end', fontVariantNumeric: 'tabular-nums' }}>
        {zeroDisplay}{suffix}
      </span>
    );
  }

  const isPositive = numValue > 0;
  const absValue = Math.abs(numValue);
  const formattedValue = formatNumber ? absValue.toLocaleString('ko-KR') : String(absValue);
  const arrow = isPositive ? '▲' : '▼';
  const sign = showSign ? (isPositive ? '+' : '-') : '';
  const color = isPositive
    ? designTokens.colors['hue-red-700']    // 상승: #b52929
    : designTokens.colors['hue-cyan-700'];  // 하락: #107b95

  return (
    <span style={{
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      color,
      fontVariantNumeric: 'tabular-nums',
      gap: '2px',
    }}>
      <span style={{ fontSize: '10px', lineHeight: 1 }}>{arrow}</span>
      {sign}{formattedValue}{suffix}
    </span>
  );
};

/**
 * 편집 가능 셀 렌더러 인터페이스 (구현 예정)
 * 조회 모드에서 일부 셀만 입력/수정 가능할 때 시각적 단서를 제공합니다.
 *
 * - Rule A (데이터 없음): 플레이스홀더 텍스트 + placeholder 색상
 * - Rule B (데이터 있음): 텍스트 + 우측 연필 아이콘
 *
 * @example
 * {
 *   field: 'memo',
 *   cellRenderer: EditableCellRenderer,
 *   cellRendererParams: {
 *     placeholder: '내용을 입력해주세요',
 *     onEdit: (data) => openEditor(data),
 *   }
 * }
 */
export interface EditableCellRendererParams {
  /** 데이터 없을 때 표시할 플레이스홀더 텍스트 */
  placeholder?: string;
  /** 편집 아이콘 클릭 시 콜백 */
  onEdit?: (data: any) => void;
  /** 편집 가능 여부 판단 함수 (기본: true) */
  isEditable?: (data: any) => boolean;
}

/**
 * AG Grid 컴포넌트 Props 인터페이스
 * AG Grid 컴포넌트에서 사용할 수 있는 모든 속성들을 정의합니다
 */
export interface DataGridProps {
  /** 필수 Props */
  /** 그리드에 표시할 행 데이터 배열 */
  rowData: any[];
  /** 컬럼 정의 배열 */
  columnDefs: (ColDef | ColGroupDef)[];

  /** 테마 및 스타일 */
  /**
   * 그리드 테마 선택
   * - 'aplus': Design Tokens 기반 커스텀 테마 (기본값, 권장)
   * - 'quartz': AG Grid Quartz 테마
   * - 'alpine': AG Grid Alpine 테마
   * - 'balham': AG Grid Balham 테마
   * - AgGridTheme: 직접 생성한 커스텀 테마 객체
   *
   * @example
   * // 프리셋 사용
   * <DataGrid theme="alpine" />
   *
   * // 커스텀 테마 사용
   * import { createGridTheme } from '@aplus/ui';
   * const myTheme = createGridTheme('aplus', { accentColor: '#ff0000' });
   * <DataGrid theme={myTheme} />
   */
  theme?: GridThemePreset | AgGridTheme;
  /**
   * 테마 파라미터 오버라이드 (theme이 프리셋일 때만 적용)
   * theme prop에 지정된 프리셋 테마에 추가 파라미터를 적용합니다
   *
   * @example
   * <DataGrid
   *   theme="aplus"
   *   themeParams={{ accentColor: '#10b981', rowHeight: 48 }}
   * />
   */
  themeParams?: ThemeParams;
  /** 그리드 높이 */
  height?: number | string;
  /** 그리드 너비 */
  width?: number | string;
  /** 추가 CSS 클래스명 */
  className?: string;

  /** 그리드 옵션 */
  /** 페이지네이션 활성화 여부 */
  pagination?: boolean;
  /** 페이지당 행 수 */
  paginationPageSize?: number;
  /** 페이지 크기 선택 옵션 */
  paginationPageSizeSelector?: number[];
  /** DOM 레이아웃 타입 */
  domLayout?: 'normal' | 'autoHeight' | 'print';

  /** 선택 옵션 */
  /** 행 선택 모드 (단일/다중) */
  rowSelection?: 'single' | 'multiple';

  /** 필터링 및 정렬 */
  /** 필터링 활성화 여부 */
  enableFilter?: boolean;
  /** 정렬 활성화 여부 */
  enableSorting?: boolean;
  /** 빠른 필터 텍스트 */
  quickFilterText?: string;

  /** 로딩 및 오버레이 */
  /** 로딩 상태 */
  loading?: boolean;
  /** 로딩 오버레이 컴포넌트 */
  loadingOverlayComponent?: string;
  /** 데이터 없음 오버레이 컴포넌트 */
  noRowsOverlayComponent?: string;

  /** 애니메이션 */
  /** 행 애니메이션 활성화 여부 */
  animateRows?: boolean;

  /** 행 그룹핑 */
  /** 자동 그룹 컬럼 정의 */
  autoGroupColumnDef?: ColDef;

  /** 편집 */
  /** 편집 타입 */
  editType?: 'fullRow';
  /** 셀 포커스 잃을 때 편집 중단 여부 */
  stopEditingWhenCellsLoseFocus?: boolean;

  /** 컨텍스트 메뉴 */
  /** 셀 선택 활성화 여부 */
  cellSelection?: boolean;
  /** 차트 기능 활성화 여부 */
  enableCharts?: boolean;

  /** 이벤트 핸들러 */
  /** 그리드 준비 완료 이벤트 */
  onGridReady?: (event: GridReadyEvent) => void;
  /** 선택 변경 이벤트 */
  onSelectionChanged?: (event: SelectionChangedEvent) => void;
  /** 셀 클릭 이벤트 */
  onCellClicked?: (event: CellClickedEvent) => void;
  /** 행 선택 이벤트 */
  onRowSelected?: (event: RowSelectedEvent) => void;
  /** 필터 변경 이벤트 */
  onFilterChanged?: (event: FilterChangedEvent) => void;
  /** 정렬 변경 이벤트 */
  onSortChanged?: (event: SortChangedEvent) => void;
  /** 셀 값 변경 이벤트 */
  onCellValueChanged?: (event: CellValueChangedEvent) => void;
  /** 컬럼 이동 이벤트 */
  onColumnMoved?: (event: ColumnMovedEvent) => void;
  /** 행 데이터 변경 이벤트 */
  onRowDataChanged?: () => void;

  /** 커스텀 함수들 */
  /** 행 ID 생성 함수 */
  getRowId?: (params: GetRowIdParams) => string;
  /** 행 CSS 클래스 생성 함수 */
  getRowClass?: (params: RowClassParams) => string | string[];

  /** 기본 컬럼 정의 */
  /** 모든 컬럼에 적용될 기본 속성 */
  defaultColDef?: ColDef;

  /** 사이드바 */
  /** 사이드바 설정 (필터, 컬럼 등) */
  sideBar?: boolean | string | any;

  /** 컬럼 순서를 유지합니다. true일 경우 컬럼을 드래그해도 원래 순서로 돌아갑니다. */
  maintainColumnOrder?: boolean;

  /** 무한 스크롤 */
  /** 행 모델 타입 */
  rowModelType?: 'clientSide' | 'infinite' | 'viewport' | 'serverSide';

  /** Advanced Filter (Enterprise) */
  /** Advanced Filter 활성화 여부 */
  enableAdvancedFilter?: boolean;

  /** 컬럼 헤더 메뉴 아이콘 표시 여부 (기본값: false) */
  showColumnMenu?: boolean;

  /** 셀 세로 정렬 (기본값: 'center') */
  cellVerticalAlign?: CellVerticalAlign;

  /**
   * 행 가로선(Row Line) 표시 여부 (기본값: false)
   * true: 행 사이 가로 구분선 표시
   * false: 구분선 없이 깔끔한 형태
   */
  showRowLine?: boolean;

  /**
   * 빈 값(null/undefined/'') 표시 문자 (기본값: '-')
   * 데이터가 없는 셀에 표시할 문자를 지정합니다.
   * false로 설정하면 빈 값 치환을 비활성화합니다.
   */
  emptyValueDisplay?: string | false;

  /** 셀 사이 세로선(Column Border) 표시 여부 (기본값: false) */
  showColumnBorder?: boolean;

  /** 헤더 세로선 표시 여부 (기본값: true) */
  showHeaderColumnBorder?: boolean;

  /** 행 높이 (기본값: 40) */
  rowHeight?: number;

  /** 헤더 높이 (기본값: 42) */
  headerHeight?: number;

  /** 데이터가 없을 때 표시할 메시지 (기본값: '표시할 데이터가 없습니다') */
  noRowsMessage?: string;

  /** 엔터프라이즈 기능들은 cellSelection.handle로 통합됨 */

  /** AG Grid 추가 속성 - pass-through */
  /** 행 클릭 선택 억제 */
  suppressRowClickSelection?: boolean;
  /** 그룹 표시 타입 */
  groupDisplayType?: 'singleColumn' | 'multipleColumns' | 'groupRows' | 'custom';
  /** 그룹 기본 펼침 레벨 */
  groupDefaultExpanded?: number;
  /** 읽기 전용 편집 */
  readOnlyEdit?: boolean;
  /** 범위 선택 활성화 */
  enableRangeSelection?: boolean;
  /** 트리 데이터 모드 */
  treeData?: boolean;
  /** 셀 텍스트 선택 활성화 */
  enableCellTextSelection?: boolean;
  /** 트리 데이터 경로 함수 */
  getDataPath?: (data: any) => string[];
  /** 집계 함수 헤더 억제 */
  suppressAggFuncInHeader?: boolean;
  /** 상단 고정 행 데이터 */
  pinnedTopRowData?: any[];
  /** 하단 고정 행 데이터 */
  pinnedBottomRowData?: any[];
  /** 컨텍스트 객체 */
  context?: any;
  /** 행 더블 클릭 이벤트 */
  onRowDoubleClicked?: (event: any) => void;
  /** 행 스타일 함수 */
  getRowStyle?: (params: any) => any;
  /** 행 그룹 패널 표시 */
  rowGroupPanelShow?: 'always' | 'never' | 'onlyWhenGrouping';
  /** 사용자 정의 집계 함수 */
  aggFuncs?: Record<string, (params: any) => any>;
  /** 컬럼 이동 억제 */
  suppressMovableColumns?: boolean;

  /** 기타 AG Grid 속성 pass-through */
  [key: string]: any;
}

/**
 * 메인 AG Grid 컴포넌트
 * 재사용 가능한 AG Grid 래퍼 컴포넌트로 다양한 옵션을 제공합니다
 */
export const DataGrid: React.FC<DataGridProps> = ({
  rowData,
  columnDefs,
  theme = 'aplus',
  themeParams,
  height = 400,
  width = '100%',
  className = '',
  pagination = false,
  paginationPageSize = 10,
  paginationPageSizeSelector = [10, 20, 50, 100],
  domLayout = 'normal',
  rowSelection,
  enableFilter = true,
  enableSorting = true,
  quickFilterText,
  loading = false,
  loadingOverlayComponent,
  noRowsOverlayComponent,
  animateRows = true,
  autoGroupColumnDef,
  editType,
  stopEditingWhenCellsLoseFocus = true,
  cellSelection = false,
  enableCharts = false,
  onGridReady,
  onSelectionChanged,
  onCellClicked,
  onRowSelected,
  onFilterChanged,
  onSortChanged,
  onCellValueChanged,
  onRowDataChanged,
  getRowId,
  getRowClass,
  defaultColDef,
  sideBar = false,
  maintainColumnOrder = true,
  rowModelType = 'clientSide',
  onColumnMoved,
  enableAdvancedFilter,
  showColumnMenu = false,
  cellVerticalAlign = 'center',
  showRowLine = false,
  emptyValueDisplay = '-',
  showColumnBorder = false,
  showHeaderColumnBorder = true,
  rowHeight: rowHeightProp,
  headerHeight: headerHeightProp,
  noRowsMessage,
  ...props
}) => {
  // AG Grid 레퍼런스
  const gridRef = useRef<AgGridReact>(null);
  // 그리드 API 상태
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // 테마 해결 로직
  const resolvedTheme = useMemo(() => {
    // props 기반 테마 파라미터 오버라이드
    const propsOverrides: ThemeParams = {
      // Row Line (행 가로선)
      ...(showRowLine
        ? { rowBorder: { style: 'solid', width: 1, color: '#0000001f' } }
        : { rowBorder: false }),
      // Column Border (셀 세로선)
      columnBorder: showColumnBorder,
      // Header Column Border (헤더 세로선)
      headerColumnBorder: showHeaderColumnBorder,
    };

    // theme이 문자열(프리셋)인 경우
    if (typeof theme === 'string') {
      const baseTheme = GRID_THEMES[theme as GridThemePreset] || GRID_THEMES.aplus;
      return baseTheme.withParams({ ...propsOverrides, ...themeParams });
    }
    // theme이 AG Grid Theme 객체인 경우
    return (theme as any).withParams ? (theme as any).withParams(propsOverrides) : theme;
  }, [theme, themeParams, showRowLine, showColumnBorder, showHeaderColumnBorder]);

  // Advanced Filter 스타일 동적 주입
  React.useEffect(() => {
    if (enableAdvancedFilter) {
      // 이미 스타일이 있는지 확인
      let styleElement = document.getElementById(ADVANCED_FILTER_STYLE_ID);
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = ADVANCED_FILTER_STYLE_ID;
        styleElement.textContent = getAdvancedFilterStyles();
        document.head.appendChild(styleElement);
      }
    }

    // Cleanup은 하지 않음 - 다른 DataGrid 인스턴스가 사용할 수 있음
  }, [enableAdvancedFilter]);

  // Pagination 스타일 동적 주입 (Figma 디자인 기준)
  React.useEffect(() => {
    if (pagination) {
      // 이미 스타일이 있는지 확인
      let styleElement = document.getElementById(PAGINATION_STYLE_ID);
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = PAGINATION_STYLE_ID;
        styleElement.textContent = getPaginationStyles();
        document.head.appendChild(styleElement);
      }
    }

    // Cleanup은 하지 않음 - 다른 DataGrid 인스턴스가 사용할 수 있음
  }, [pagination]);

  // Aplus 테마 스타일 동적 주입 (Figma 디자인 기준)
  React.useEffect(() => {
    // aplus 테마일 때만 스타일 주입
    const isAplusTheme = theme === 'aplus' || theme === 'aplusDark' || theme === undefined;
    if (isAplusTheme) {
      let styleElement = document.getElementById(APLUS_THEME_STYLE_ID);
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = APLUS_THEME_STYLE_ID;
        styleElement.textContent = getAplusThemeStyles();
        document.head.appendChild(styleElement);
      }
    }

    // Cleanup은 하지 않음 - 다른 DataGrid 인스턴스가 사용할 수 있음
  }, [theme]);

  // 빈 값(Null/Undefined) → emptyValueDisplay 표시 기본 valueFormatter
  const nullSafeValueFormatter = useCallback(
    (params: ValueFormatterParams) => {
      // emptyValueDisplay가 false이면 빈 값 치환 비활성화
      const placeholder = emptyValueDisplay === false ? '' : emptyValueDisplay;

      // 사용자 정의 valueFormatter가 있으면 우선 적용
      if (defaultColDef?.valueFormatter && typeof defaultColDef.valueFormatter === 'function') {
        const result = defaultColDef.valueFormatter(params);
        if (placeholder && (result == null || result === '')) return placeholder;
        return result;
      }
      if (placeholder && (params.value == null || params.value === '')) return placeholder;
      return params.value;
    },
    [defaultColDef, emptyValueDisplay]
  );

  // 기본 컬럼 정의 메모이제이션
  const memoizedDefaultColDef = useMemo(
    () => {
      const { valueFormatter: _userFormatter, ...restDefaultColDef } = defaultColDef || {};
      return {
        sortable: enableSorting,
        filter: enableFilter,
        resizable: true,
        suppressMenu: !showColumnMenu, // 메뉴 아이콘 기본 숨김
        menuTabs: ['filterMenuTab' as any, 'generalMenuTab' as any],
        cellClass: cn(
          cellAlignVariants({ verticalAlign: cellVerticalAlign }),
          defaultColDef?.cellClass as string | undefined
        ),
        ...restDefaultColDef,
        valueFormatter: nullSafeValueFormatter,
      };
    },
    [enableSorting, enableFilter, showColumnMenu, cellVerticalAlign, defaultColDef, nullSafeValueFormatter]
  );

  // 그리드 준비 이벤트 핸들러
  const handleGridReady = useCallback(
    (event: GridReadyEvent) => {
      setGridApi(event.api);

      if (onGridReady) {
        onGridReady(event);
      }
    },
    [onGridReady]
  );

  // noRowsMessage locale 오버라이드
  const localeText = useMemo(() => {
    if (!noRowsMessage) return AG_GRID_LOCALE_KO;
    return { ...AG_GRID_LOCALE_KO, noRowsToShow: noRowsMessage };
  }, [noRowsMessage]);

  // 그리드 옵션 메모이제이션
  const gridOptions: GridOptions = useMemo(
    () => ({
      rowData,
      columnDefs,
      defaultColDef: memoizedDefaultColDef,
      pagination,
      paginationPageSize,
      paginationPageSizeSelector,
      domLayout,
      rowSelection: rowSelection === 'multiple' ? 'multiple' : rowSelection === 'single' ? 'single' : rowSelection,
      animateRows,
      autoGroupColumnDef,
      editType,
      stopEditingWhenCellsLoseFocus,
      cellSelection,
      enableCharts,
      getRowId,
      getRowClass,
      sideBar,
      maintainColumnOrder,
      rowModelType,
      loadingOverlayComponent,
      noRowsOverlayComponent,
      suppressMenuHide: !showColumnMenu, // 메뉴 아이콘 hover 시에도 숨김 유지
      localeText,
      rowHeight: rowHeightProp ?? (typeof themeParams?.rowHeight === 'number' ? themeParams.rowHeight : 40),
      headerHeight: headerHeightProp ?? (typeof themeParams?.headerHeight === 'number' ? themeParams.headerHeight : 42),
      ...(enableAdvancedFilter !== undefined && { enableAdvancedFilter }),
      ...props,
    }),
    [
      rowData,
      columnDefs,
      memoizedDefaultColDef,
      pagination,
      paginationPageSize,
      paginationPageSizeSelector,
      domLayout,
      rowSelection,
      animateRows,
      autoGroupColumnDef,
      editType,
      stopEditingWhenCellsLoseFocus,
      cellSelection,
      enableCharts,
      getRowId,
      getRowClass,
      sideBar,
      maintainColumnOrder,
      rowModelType,
      loadingOverlayComponent,
      noRowsOverlayComponent,
      enableAdvancedFilter,
      showColumnMenu,
      localeText,
      rowHeightProp,
      headerHeightProp,
      themeParams,
      props,
    ]
  );

  // 퀵 필터 적용 이펙트
  React.useEffect(() => {
    if (gridApi && quickFilterText !== undefined) {
      gridApi.setGridOption('quickFilterText', quickFilterText);
    }
  }, [gridApi, quickFilterText]);

  // 로딩 상태 처리 이펙트
  React.useEffect(() => {
    if (gridApi) {
      if (loading) {
        gridApi.setGridOption('loading', true);
      } else {
        gridApi.setGridOption('loading', false);
      }
    }
  }, [gridApi, loading]);

  // 메뉴 숨김 클래스 결합
  const gridClassName = `${className} ${!showColumnMenu ? 'hide-column-menu' : ''}`.trim();

  return (
    <div className={gridClassName} style={{ height, width }}>
      {React.createElement(AgGridReact as any, {
        ref: gridRef,
        theme: resolvedTheme,
        ...gridOptions,
        onGridReady: handleGridReady,
        onSelectionChanged: onSelectionChanged,
        onCellClicked: onCellClicked,
        onRowSelected: onRowSelected,
        onFilterChanged: onFilterChanged,
        onSortChanged: onSortChanged,
        onCellValueChanged: onCellValueChanged,
        onColumnMoved: onColumnMoved,
      })}
    </div>
  );
};

/**
 * 사전 정의된 컬럼 타입들
 * 자주 사용되는 컬럼 타입들을 미리 정의해놓은 객체
 */
export const COLUMN_TYPES = {
  /** 숫자 컬럼 타입 */
  numberColumn: {
    width: 130,
    filter: 'agNumberColumnFilter',
    cellClass: 'ag-right-aligned-cell',
    headerClass: 'ag-right-aligned-header',
  },
  /** 날짜 컬럼 타입 - 고정 길이 데이터이므로 중앙 정렬 */
  dateColumn: {
    filter: 'agDateColumnFilter',
    cellEditor: 'agDateCellEditor',
    width: 150,
    cellClass: 'ag-center-aligned-cell',
    headerClass: 'ag-center-aligned-header',
  },
  /** 상태 컬럼 타입 - 짧은 단어/상태 표시용 중앙 정렬 */
  statusColumn: {
    width: 120,
    cellClass: 'ag-center-aligned-cell',
    headerClass: 'ag-center-aligned-header',
    sortable: false,
    filter: false,
  },
  /** 아이콘/버튼 컬럼 타입 - 중앙 정렬 */
  iconColumn: {
    width: 80,
    cellClass: 'ag-center-aligned-cell',
    headerClass: 'ag-center-aligned-header',
    sortable: false,
    filter: false,
  },
  /** 통화 컬럼 타입 */
  currencyColumn: {
    width: 150,
    filter: 'agNumberColumnFilter',
    cellClass: 'ag-right-aligned-cell',
    headerClass: 'ag-right-aligned-header',
    valueFormatter: (params: ValueFormatterParams) => {
      if (params.value == null) return '-';
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
      }).format(params.value);
    },
  },
  /** 퍼센트 컬럼 타입 */
  percentColumn: {
    width: 130,
    filter: 'agNumberColumnFilter',
    cellClass: 'ag-right-aligned-cell',
    headerClass: 'ag-right-aligned-header',
    valueFormatter: (params: ValueFormatterParams) => {
      if (params.value == null) return '-';
      return `${params.value}%`;
    },
  },
};

/**
 * AG Grid 유틸리티 함수들
 * 그리드 조작을 위한 편의 함수들을 제공합니다
 */
export const AgGridUtils = {
  /**
   * 데이터를 CSV 형식으로 내보내기
   * @param gridApi - AG Grid API 객체
   * @param filename - 파일명 (선택사항)
   */
  exportToCsv: (gridApi: GridApi, filename?: string) => {
    gridApi.exportDataAsCsv({
      fileName: filename || `export_${Date.now()}.csv`,
    });
  },

  /**
   * 데이터를 Excel 형식으로 내보내기
   * @param gridApi - AG Grid API 객체
   * @param filename - 파일명 (선택사항)
   */
  exportToExcel: (gridApi: GridApi, filename?: string) => {
    gridApi.exportDataAsExcel({
      fileName: filename || `export_${Date.now()}.xlsx`,
    });
  },

  /**
   * 선택된 행들 가져오기
   * @param gridApi - AG Grid API 객체
   * @returns 선택된 행 데이터 배열
   */
  getSelectedRows: (gridApi: GridApi) => {
    return gridApi.getSelectedRows();
  },

  /**
   * 모든 행 선택
   * @param gridApi - AG Grid API 객체
   */
  selectAll: (gridApi: GridApi) => {
    gridApi.selectAll();
  },

  /**
   * 모든 행 선택 해제
   * @param gridApi - AG Grid API 객체
   */
  deselectAll: (gridApi: GridApi) => {
    gridApi.deselectAll();
  },

  /**
   * 특정 행으로 스크롤
   * @param gridApi - AG Grid API 객체
   * @param rowIndex - 스크롤할 행 인덱스
   */
  scrollToRow: (gridApi: GridApi, rowIndex: number) => {
    gridApi.ensureIndexVisible(rowIndex);
  },

  /**
   * 모든 컬럼 크기 자동 조정
   * @param gridApi - AG Grid API 객체
   */
  autoSizeAllColumns: (gridApi: GridApi) => {
    const allColumnIds = gridApi.getColumns()?.map(col => col.getColId()) || [];
    gridApi.autoSizeColumns(allColumnIds);
  },

  /**
   * 현재 필터 상태 가져오기
   * @param gridApi - AG Grid API 객체
   * @returns 필터 모델 객체
   */
  getFilterModel: (gridApi: GridApi) => {
    return gridApi.getFilterModel();
  },

  /**
   * 필터 상태 설정
   * @param gridApi - AG Grid API 객체
   * @param filterModel - 설정할 필터 모델
   */
  setFilterModel: (gridApi: GridApi, filterModel: any) => {
    gridApi.setFilterModel(filterModel);
  },

  /**
   * 현재 정렬 상태 가져오기
   * @param gridApi - AG Grid API 객체
   * @returns 컬럼 상태 배열
   */
  getSortModel: (gridApi: GridApi) => {
    return gridApi.getColumnState();
  },

  /**
   * 정렬 상태 설정
   * @param gridApi - AG Grid API 객체
   * @param sortModel - 설정할 정렬 모델
   */
  setSortModel: (gridApi: GridApi, sortModel: any[]) => {
    gridApi.applyColumnState({ state: sortModel });
  },
};

// 기본 내보내기
export default DataGrid;
