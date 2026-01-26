/**
 * DS Extraction Types
 *
 * Public Storybook URL에서 추출한 디자인 시스템 메타데이터 타입 정의
 * @see docs/specs/ds-hub-storybook-extraction.md
 */

// =============================================================================
// ds.json 스키마 (신규 형식)
// =============================================================================

/**
 * Story 정보 (iframe preview 생성에 필요)
 */
export interface StoryInfo {
  /** 스토리 고유 ID (예: "button--primary") */
  id: string;
  /** 스토리 표시 이름 (예: "Primary") */
  name: string;
}

/**
 * Props 정보 (HTML ArgTypes 테이블에서 추출)
 */
export interface PropInfo {
  /** Prop 이름 */
  name: string;
  /** 설명 */
  description: string | null;
  /** 타입 (union의 경우 배열) */
  type: string[];
  /** 기본값 */
  defaultValue: string | null;
  /** 필수 여부 (HTML 테이블에서 추출 불가한 경우 false) */
  required: boolean;
  /** Control 타입 */
  control: 'select' | 'number' | 'text' | 'boolean' | 'object' | null;
  /** select의 경우 옵션 목록 */
  options: string[] | null;
}

/**
 * 컴포넌트 정보
 */
export interface DSComponent {
  /** 컴포넌트 이름 */
  name: string;
  /** 카테고리 (UI, Form, Layout 등) */
  category: string;
  /** 원본 파일 경로 (Storybook importPath) */
  filePath: string | null;
  /** 태그 목록 (autodocs, deprecated 등) */
  tags: string[];
  /** 스토리 정보 목록 (ID + 이름) */
  stories: StoryInfo[];
  /** Props 정보 */
  props: PropInfo[];
}

/**
 * ds.json 스키마 (Public URL 추출용) - 배열 형식
 */
export interface DSJson {
  /** 디자인 시스템 이름 */
  name: string;
  /** 원본 Storybook URL */
  source: string;
  /** 스키마 버전 */
  version: string;
  /** 추출 일시 (ISO 8601) */
  extractedAt: string;
  /** 컴포넌트 목록 (배열) */
  components: DSComponent[];
}

/**
 * ds.json 스키마 (Object 형식) - O(1) 컴포넌트 조회용
 * AI 분석 시 빠른 컴포넌트 lookup을 위해 사용
 */
export interface DSJsonWithObjectComponents {
  /** 디자인 시스템 이름 */
  name: string;
  /** 원본 Storybook URL */
  source: string;
  /** 스키마 버전 */
  version: string;
  /** 추출 일시 (ISO 8601) */
  extractedAt: string;
  /** 컴포넌트 맵 (컴포넌트 이름 → 컴포넌트 정보) */
  components: Record<string, Omit<DSComponent, 'name'>>;
}

// =============================================================================
// Storybook index.json 타입
// =============================================================================

/**
 * Storybook 스토리 엔트리
 */
export interface StoryEntry {
  /** 스토리 고유 ID */
  id: string;
  /** 컴포넌트 경로 (예: "UI/Badge") */
  title: string;
  /** 스토리 이름 (예: "Primary") */
  name: string;
  /** 원본 파일 경로 */
  importPath: string;
  /** 타입: docs 또는 story */
  type: 'docs' | 'story';
  /** 태그 배열 */
  tags?: string[];
  /** 스토리 imports */
  storiesImports?: string[];
}

/**
 * Storybook index.json 구조
 */
export interface StorybookIndex {
  /** 버전 */
  v: number;
  /** 스토리 엔트리 맵 */
  entries: Record<string, StoryEntry>;
}

// =============================================================================
// 내부 처리용 타입
// =============================================================================

/**
 * 컴포넌트 정보 (추출 중간 단계)
 */
export interface ComponentInfo {
  /** 카테고리 */
  category: string;
  /** 컴포넌트 이름 */
  name: string;
  /** 원본 파일 경로 (Storybook importPath) */
  filePath: string | null;
  /** 태그 목록 (autodocs, deprecated 등) */
  tags: string[];
  /** 스토리 정보 목록 (ID + 이름) */
  stories: StoryInfo[];
  /** docs 타입 스토리 ID (ArgTypes 추출용) */
  docsId: string | null;
}

// =============================================================================
// Legacy component-schema.json 타입 (호환용)
// =============================================================================

/**
 * Legacy Props 스키마
 */
export interface LegacyPropSchema {
  type: string | string[];
  required: boolean;
  defaultValue?: unknown;
  description?: string;
}

/**
 * Legacy 스토리 스키마
 */
export interface LegacyStorySchema {
  id: string;
  name: string;
  tags?: string[];
}

/**
 * Legacy 컴포넌트 스키마
 */
export interface LegacyComponentSchema {
  displayName: string;
  filePath: string;
  category: string;
  props: Record<string, LegacyPropSchema>;
  stories: LegacyStorySchema[];
}

/**
 * Legacy component-schema.json 구조
 */
export interface ComponentSchemaJson {
  version: string;
  generatedAt: string;
  components: Record<string, LegacyComponentSchema>;
}

// =============================================================================
// API 요청/응답 타입
// =============================================================================

/**
 * 추출 요청
 */
export interface ExtractRequest {
  /** Storybook URL */
  url: string;
}

/**
 * 추출 응답 (성공)
 */
export interface ExtractSuccessResponse {
  success: true;
  data: DSJson | ComponentSchemaJson;
  format: 'ds' | 'legacy';
  /** 저장된 정적 파일 경로 (예: /ds-schemas/workday.ds.json) */
  savedPath: string;
  /** 추출 과정에서 발생한 경고 */
  warnings?: ExtractWarning[];
}

/**
 * 추출 응답 (실패)
 */
export interface ExtractErrorResponse {
  success: false;
  error: string;
  code: ExtractErrorCode;
}

/**
 * 추출 에러 코드
 */
export type ExtractErrorCode =
  | 'INVALID_URL'
  | 'FETCH_FAILED'
  | 'INDEX_NOT_FOUND'
  | 'UNSUPPORTED_VERSION'
  | 'PARSE_ERROR'
  | 'INTERNAL_ERROR';

/**
 * 추출 경고 타입
 */
export type ExtractWarningType =
  | 'PLACEHOLDER_PROPS'
  | 'CSR_DETECTED'
  | 'EMPTY_ARGTYPES';

/**
 * 추출 경고
 */
export interface ExtractWarning {
  type: ExtractWarningType;
  message: string;
  affectedComponents?: string[];
}

/**
 * 추출 응답
 */
export type ExtractResponse = ExtractSuccessResponse | ExtractErrorResponse;
