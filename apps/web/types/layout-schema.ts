/**
 * Figma 레이아웃 추출 유틸리티 타입 정의
 *
 * Figma API로부터 레이아웃 구조를 추출하고 변환하기 위한 타입들을 정의합니다.
 *
 * @module types/layout-schema
 */

// ============================================================
// Section 1: Figma URL Parsing Types
// ============================================================

/**
 * 파싱된 Figma URL 정보
 *
 * Figma 파일 URL에서 추출한 파일 키와 노드 ID 정보
 */
export interface FigmaUrlInfo {
  /** Figma 파일 고유 키 */
  fileKey: string;

  /** 특정 노드 ID (옵션) */
  nodeId: string;

  /** 원본 Figma URL */
  originalUrl: string;
}

// ============================================================
// Section 2: Figma API Response Types
// ============================================================

/**
 * Figma 노드 타입
 *
 * Figma에서 지원하는 모든 노드 타입의 유니온
 */
export type FigmaNodeType =
  | 'DOCUMENT'
  | 'CANVAS'
  | 'FRAME'
  | 'GROUP'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'TEXT'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'LINE'
  | 'VECTOR'
  | 'BOOLEAN_OPERATION'
  | 'SECTION';

/**
 * Figma 레이아웃 모드
 *
 * Auto Layout의 방향성을 나타냄
 */
export type FigmaLayoutMode =
  | 'NONE'
  | 'HORIZONTAL'
  | 'VERTICAL';

/**
 * Figma 사이징 모드
 *
 * Auto Layout에서 자식 요소의 크기 조정 방식
 */
export type FigmaSizingMode =
  | 'FIXED'
  | 'HUG'
  | 'FILL';

/**
 * Figma 바운딩 박스
 *
 * 노드의 절대 위치와 크기 정보
 */
export interface FigmaBoundingBox {
  /** X 좌표 */
  x: number;

  /** Y 좌표 */
  y: number;

  /** 너비 */
  width: number;

  /** 높이 */
  height: number;
}

/**
 * Figma 텍스트 스타일
 *
 * 텍스트 노드의 타이포그래피 속성
 */
export interface FigmaTextStyle {
  /** 폰트 패밀리 */
  fontFamily?: string;

  /** 폰트 크기 (px) */
  fontSize?: number;

  /** 폰트 두께 */
  fontWeight?: number;

  /** 수평 정렬 */
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';

  /** 행간 (px) */
  lineHeightPx?: number;

  /** 자간 */
  letterSpacing?: number;
}

/**
 * Figma 색상
 *
 * RGBA 색상 정보 (0-1 범위로 정규화됨)
 */
export interface FigmaColor {
  /** 빨강 (0-1) */
  r: number;

  /** 초록 (0-1) */
  g: number;

  /** 파랑 (0-1) */
  b: number;

  /** 투명도 (0-1) */
  a: number;
}

/**
 * Figma 페인트
 *
 * 노드의 채우기/테두리 색상 정보
 */
export interface FigmaPaint {
  /** 페인트 타입 (SOLID, GRADIENT, IMAGE 등) */
  type: string;

  /** 색상 정보 (SOLID 타입인 경우) */
  color?: FigmaColor;

  /** 불투명도 (0-1) */
  opacity?: number;
}

/**
 * Figma 노드
 *
 * Figma API에서 반환하는 노드의 전체 구조
 * 재귀적으로 자식 노드를 포함할 수 있음
 */
export interface FigmaNode {
  /** 노드 고유 ID */
  id: string;

  /** 노드 이름 */
  name: string;

  /** 노드 타입 */
  type: FigmaNodeType;

  /** 자식 노드 배열 */
  children?: FigmaNode[];

  // Layout props
  /** Auto Layout 모드 */
  layoutMode?: FigmaLayoutMode;

  /** 자식 요소 간 간격 */
  itemSpacing?: number;

  /** 왼쪽 패딩 */
  paddingLeft?: number;

  /** 오른쪽 패딩 */
  paddingRight?: number;

  /** 위쪽 패딩 */
  paddingTop?: number;

  /** 아래쪽 패딩 */
  paddingBottom?: number;

  /** 주축 사이징 모드 */
  primaryAxisSizingMode?: FigmaSizingMode;

  /** 교차축 사이징 모드 */
  counterAxisSizingMode?: FigmaSizingMode;

  /** 주축 정렬 */
  primaryAxisAlignItems?: string;

  /** 교차축 정렬 */
  counterAxisAlignItems?: string;

  /** 레이아웃 정렬 */
  layoutAlign?: string;

  /** 레이아웃 성장 비율 */
  layoutGrow?: number;

  // Size props
  /** 절대 바운딩 박스 */
  absoluteBoundingBox?: FigmaBoundingBox;

  /** 상대 크기 */
  size?: { x: number; y: number };

  /** 제약 조건 */
  constraints?: unknown;

  // Text props
  /** 텍스트 내용 */
  characters?: string;

  /** 텍스트 스타일 */
  style?: FigmaTextStyle;

  /** 텍스트 채우기 색상 */
  fills?: FigmaPaint[];

  // Instance props
  /** 컴포넌트 ID (인스턴스인 경우) */
  componentId?: string;

  /** 컴포넌트 속성 (인스턴스인 경우) */
  componentProperties?: Record<string, { type: string; value: string }>;
}

/**
 * Figma 컴포넌트 메타데이터
 *
 * 컴포넌트의 기본 정보
 */
export interface FigmaComponentMeta {
  /** 컴포넌트 고유 키 */
  key: string;

  /** 컴포넌트 이름 */
  name: string;

  /** 컴포넌트 설명 */
  description: string;

  /** 컴포넌트 세트 ID (variant인 경우) */
  componentSetId?: string;
}

/**
 * Figma 노드 응답
 *
 * Figma API `/v1/files/:key/nodes` 엔드포인트의 응답 구조
 */
export interface FigmaNodesResponse {
  /** 파일 이름 */
  name: string;

  /** 마지막 수정 시각 */
  lastModified: string;

  /** 썸네일 URL */
  thumbnailUrl: string;

  /** 노드 맵 (노드 ID -> 노드 데이터) */
  nodes: Record<
    string,
    {
      /** 노드 문서 구조 */
      document: FigmaNode;

      /** 컴포넌트 메타데이터 맵 */
      components: Record<string, FigmaComponentMeta>;

      /** 컴포넌트 세트 맵 */
      componentSets: Record<
        string,
        { key: string; name: string; description: string }
      >;

      /** 스타일 맵 */
      styles: Record<
        string,
        { key: string; name: string; styleType: string; description: string }
      >;
    } | null
  >;
}

// ============================================================
// Section 3: Layout Schema Output Types
// ============================================================

/**
 * 크기 값
 *
 * 고정 크기(px) 또는 Auto Layout 사이징 모드
 */
export type SizeValue = number | 'FILL' | 'HUG';

/**
 * 레이아웃 크기
 *
 * 너비와 높이 정보
 */
export interface LayoutSize {
  /** 너비 */
  width: SizeValue;

  /** 높이 */
  height: SizeValue;
}

/**
 * 레이아웃 패딩
 *
 * 상하좌우 패딩 값 (px)
 */
export interface LayoutPadding {
  /** 위쪽 패딩 */
  top: number;

  /** 오른쪽 패딩 */
  right: number;

  /** 아래쪽 패딩 */
  bottom: number;

  /** 왼쪽 패딩 */
  left: number;
}

/**
 * 레이아웃 텍스트 스타일
 *
 * 추출된 텍스트의 타이포그래피 정보
 */
export interface LayoutTextStyle {
  /** 폰트 크기 (px) */
  fontSize: number;

  /** 폰트 두께 */
  fontWeight: number;

  /** 폰트 패밀리 */
  fontFamily?: string;

  /** 텍스트 정렬 */
  textAlign?: string;

  /** 텍스트 색상 (hex) */
  color?: string;

  /** 행간 (px) */
  lineHeight?: number;
}

/**
 * 레이아웃 노드
 *
 * Figma 노드에서 추출한 레이아웃 구조
 * 재귀적으로 자식 노드를 포함할 수 있음
 */
export interface LayoutNode {
  /** 노드 이름 */
  name: string;

  /** 노드 타입 */
  type: string;

  /** 레이아웃 모드 */
  layoutMode?: 'VERTICAL' | 'HORIZONTAL';

  /** 크기 정보 */
  size?: LayoutSize;

  /** 패딩 정보 */
  padding?: LayoutPadding;

  /** 자식 요소 간 간격 (px) */
  itemSpacing?: number;

  /** 자식 노드 배열 */
  children?: LayoutNode[];

  /** 텍스트 내용 (텍스트 노드인 경우) */
  text?: string;

  /** 텍스트 스타일 (텍스트 노드인 경우) */
  textStyle?: LayoutTextStyle;

  /** 컴포넌트 이름 (인스턴스인 경우) */
  componentName?: string;

  /** 컴포넌트 속성 (인스턴스인 경우) */
  componentProps?: Record<string, string>;
}

/**
 * 추출된 컴포넌트
 *
 * 레이아웃에서 발견된 컴포넌트 사용 정보
 */
export interface ExtractedComponent {
  /** 컴포넌트 이름 */
  name: string;

  /** 사용된 인스턴스 개수 */
  instances: number;

  /** 사용된 variant 목록 */
  variants: string[];
}

/**
 * 타이포그래피 정보
 *
 * 추출된 텍스트 스타일 정보
 */
export interface TypographyInfo {
  /** 폰트 크기 (px) */
  fontSize: number;

  /** 폰트 두께 */
  fontWeight: number;

  /** 폰트 패밀리 */
  fontFamily?: string;
}

/**
 * 추출된 스타일
 *
 * 레이아웃에서 발견된 디자인 토큰 (색상, 간격, 타이포그래피)
 */
export interface ExtractedStyles {
  /** 사용된 색상 목록 (hex) */
  colors: string[];

  /** 사용된 간격 값 목록 (px) */
  spacing: number[];

  /** 사용된 타이포그래피 맵 (이름 -> 정보) */
  typography: Record<string, TypographyInfo>;
}

/**
 * 레이아웃 스키마
 *
 * Figma에서 추출한 전체 레이아웃 정보
 */
export interface LayoutSchema {
  /** 스키마 버전 */
  version: string;

  /** 생성 시각 (ISO 8601) */
  generatedAt: string;

  /** 원본 Figma URL */
  sourceUrl: string;

  /** 레이아웃 트리 */
  layout: LayoutNode;

  /** 추출된 컴포넌트 목록 */
  extractedComponents: ExtractedComponent[];

  /** 추출된 스타일 정보 */
  styles: ExtractedStyles;
}

// ============================================================
// Section 4: API Request/Response Types
// ============================================================

/**
 * Figma 추출 에러 코드
 *
 * API 에러 상황을 구분하기 위한 코드
 */
export type FigmaExtractErrorCode =
  | 'INVALID_URL'
  | 'MISSING_TOKEN'
  | 'FIGMA_API_ERROR'
  | 'RATE_LIMITED'
  | 'PARSE_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Figma 추출 요청
 *
 * POST /api/figma/extract 엔드포인트의 요청 바디
 */
export interface FigmaExtractRequest {
  /** Figma 파일 또는 노드 URL */
  url: string;
}

/**
 * Figma 추출 성공 응답
 *
 * 레이아웃 추출 성공 시 응답
 */
export interface FigmaExtractSuccessResponse {
  /** 성공 여부 */
  success: true;

  /** 추출된 레이아웃 스키마 */
  data: LayoutSchema;
}

/**
 * Figma 추출 에러 응답
 *
 * 레이아웃 추출 실패 시 응답
 */
export interface FigmaExtractErrorResponse {
  /** 성공 여부 */
  success: false;

  /** 에러 메시지 */
  error: string;

  /** 에러 코드 */
  code: FigmaExtractErrorCode;
}

/**
 * Figma 추출 응답
 *
 * POST /api/figma/extract 엔드포인트의 응답 타입
 */
export type FigmaExtractResponse =
  | FigmaExtractSuccessResponse
  | FigmaExtractErrorResponse;
