/**
 * Design Validator MCP Extension 타입 정의
 */

// 토큰 타입
export interface DesignTokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  typography: Record<string, TypographyValue>;
  tokenMapping: Record<string, string>; // 토큰 키 → Figma 토큰 이름 매핑
}

// 토큰 이름이 포함된 스타일 값 (예: "color/role/text/primary (#212529)")
export interface StyleValueWithToken {
  value: string;
  tokenName?: string;
}

// 스타일 값을 "tokenName (#value)" 형식으로 포맷
export function formatStyleValue(value: string, tokenName?: string): string {
  if (tokenName) {
    return `${tokenName} (${value})`;
  }
  return value;
}

export interface TypographyValue {
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
}

// 스타일 결과 타입
export interface ResolvedStyles {
  [key: string]: string;
}

// 컴포넌트 정의 타입
export interface ComponentDefinition {
  base: string;
  variants: Record<string, Record<string, string>>;
  compoundVariants?: CompoundVariant[];
  defaultVariants: Record<string, string | boolean>;
}

export interface CompoundVariant {
  variant?: string | string[];
  size?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  class: string;
  [key: string]: string | string[] | boolean | undefined;
}

// Tool 입출력 타입
export interface ListComponentsInput {
  category?: string;
}

export interface ListComponentsOutput {
  components: ComponentInfo[];
  total: number;
}

export interface ComponentInfo {
  name: string;
  variants: string[];
  sizes: string[];
}

export interface GetImplementedStyleInput {
  component: string;
  variant?: string;
  size?: string;
  property?: string;
  state?: 'default' | 'hover' | 'focus-visible' | 'active' | 'all'; // 상태별 스타일 조회
}

export interface GetImplementedStyleOutput {
  component: string;
  variant: string;
  size: string;
  styles: ResolvedStyles;
  stateStyles?: Record<string, ResolvedStyles>; // state='all' 요청 시 모든 상태별 스타일
}

// 타입 가드 함수
export function isListComponentsInput(obj: unknown): obj is ListComponentsInput {
  if (obj === undefined || obj === null) return true; // undefined/null은 빈 입력으로 처리
  if (typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  if ('category' in record && typeof record.category !== 'string') return false;
  return true;
}

const VALID_STATES = ['default', 'hover', 'focus-visible', 'active', 'all'] as const;

export function isGetImplementedStyleInput(obj: unknown): obj is GetImplementedStyleInput {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  if (!('component' in record) || typeof record.component !== 'string') return false;
  if ('variant' in record && typeof record.variant !== 'string') return false;
  if ('size' in record && typeof record.size !== 'string') return false;
  if ('property' in record && typeof record.property !== 'string') return false;
  if ('state' in record) {
    if (typeof record.state !== 'string') return false;
    if (!VALID_STATES.includes(record.state as (typeof VALID_STATES)[number])) return false;
  }
  return true;
}

// 출력 타입 가드
export function isListComponentsOutput(
  obj: ListComponentsOutput | GetImplementedStyleOutput
): obj is ListComponentsOutput {
  return 'total' in obj && 'components' in obj;
}

export function isGetImplementedStyleOutput(
  obj: ListComponentsOutput | GetImplementedStyleOutput
): obj is GetImplementedStyleOutput {
  return 'styles' in obj && 'variant' in obj;
}
