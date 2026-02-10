/**
 * 레이아웃 관련 상수
 */
export const LAYOUT = {
  /** 헤더 높이 (px) */
  HEADER_HEIGHT: 56,

  /** Left Panel 기본 크기 (%) */
  LEFT_PANEL_DEFAULT: 35,

  /** Left Panel 최소 크기 (%) */
  LEFT_PANEL_MIN: 20,

  /** Left Panel 최대 크기 (%) */
  LEFT_PANEL_MAX: 50,

  /** Left Panel 최소 너비 (px) */
  LEFT_PANEL_MIN_PX: 280,

  /** Left Panel 최대 너비 (px) */
  LEFT_PANEL_MAX_PX: 600,

  /** Left Panel 접힌 상태 크기 (%) - 0이면 완전히 숨김 */
  LEFT_PANEL_COLLAPSED_SIZE: 0,

  /** 모바일 바텀시트 기본 높이 (vh) */
  MOBILE_SHEET_DEFAULT_HEIGHT: 40,

  /** 모바일 바텀시트 최소 높이 (vh) */
  MOBILE_SHEET_MIN_HEIGHT: 20,

  /** 모바일 바텀시트 최대 높이 (vh) */
  MOBILE_SHEET_MAX_HEIGHT: 80,
} as const;

/**
 * 브레이크포인트 (Tailwind 기본값과 동기화)
 */
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

/**
 * z-index 레이어
 */
export const Z_INDEX = {
  HEADER: 50,
  PANEL: 10,
  MOBILE_SHEET: 40,
  OVERLAY: 30,
  MODAL: 100,
} as const;
