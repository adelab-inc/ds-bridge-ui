/**
 * get_implemented_style Tool 구현
 * Storybook 컴포넌트 스타일을 조회합니다.
 */
import { TokenReader } from '../utils/token-reader';
import { ClassResolver } from '../utils/class-resolver';
import type { DesignTokens, GetImplementedStyleInput, GetImplementedStyleOutput } from '../types';
import fs from 'fs/promises';
import path from 'path';

/**
 * 컴포넌트 스타일 조회
 * @param input - 조회 조건 (component, variant, size, property, state)
 * @param basePath - component-definitions.json, tokens.json 위치
 */
export async function getImplementedStyle(
  input: GetImplementedStyleInput,
  basePath: string
): Promise<GetImplementedStyleOutput> {
  const reader = new TokenReader(basePath);

  // 컴포넌트 정의 가져오기
  const definition = await reader.getComponentDefinition(input.component);

  if (!definition) {
    throw new Error(
      `컴포넌트 '${input.component}'을(를) 찾을 수 없습니다.`
    );
  }

  // 기본값으로 variant/size 보완
  const variant = input.variant ?? String(definition.defaultVariants.variant ?? '');
  const size = input.size ?? String(definition.defaultVariants.size ?? '');

  // 옵션 구성
  const options: Record<string, string | boolean> = {
    ...definition.defaultVariants,
  };

  if (input.variant !== undefined) {
    options.variant = input.variant;
  }

  if (input.size !== undefined) {
    options.size = input.size;
  }

  // 클래스 배열 가져오기
  const classes = await reader.getComponentClasses(input.component, options);

  // 토큰 파일 읽기
  const tokens = await loadTokens(basePath);

  // 클래스 → CSS 스타일 변환
  const resolver = new ClassResolver(tokens);

  // state 파라미터에 따른 스타일 조회
  if (input.state === 'all') {
    // 모든 상태별 스타일 조회
    const allStateStyles = resolver.resolveWithStates(classes);
    const styles = allStateStyles.default || {};

    // undefined 값 필터링 및 default 제외
    const filteredStateStyles: Record<string, Record<string, string>> = {};
    for (const [state, stateStyle] of Object.entries(allStateStyles)) {
      if (state !== 'default' && stateStyle) {
        filteredStateStyles[state] = stateStyle;
      }
    }

    return {
      component: input.component,
      variant,
      size,
      styles,
      stateStyles: Object.keys(filteredStateStyles).length > 0 ? filteredStateStyles : undefined,
    };
  } else if (input.state && input.state !== 'default') {
    // 특정 상태 스타일만 조회
    const stateStyles = resolver.getStateStyles(classes, input.state);
    const defaultStyles = resolver.resolve(classes.filter((c) => !c.includes(':')));

    return {
      component: input.component,
      variant,
      size,
      styles: defaultStyles,
      stateStyles: Object.keys(stateStyles).length > 0 ? { [input.state]: stateStyles } : undefined,
    };
  }

  // 기본: default 상태만 조회
  const styles = resolver.resolve(classes);

  return {
    component: input.component,
    variant,
    size,
    styles,
  };
}

/**
 * design-tokens.json에서 fontSize 값 파싱
 * 형식: ["18px", { "lineHeight": "28px" }] 또는 string
 */
interface FontSizeValue {
  fontSize: string;
  lineHeight: string;
}

function parseFontSize(value: unknown): FontSizeValue | null {
  if (Array.isArray(value) && value.length >= 2) {
    const [fontSize, options] = value;
    if (typeof fontSize === 'string' && typeof options === 'object' && options !== null) {
      return {
        fontSize,
        lineHeight: (options as { lineHeight?: string }).lineHeight || fontSize,
      };
    }
  }
  return null;
}

/**
 * design-tokens.json 형식을 DesignTokens로 변환
 */
function convertDesignTokensJSON(raw: {
  designTokens: {
    colors?: Record<string, string>;
    spacing?: Record<string, string>;
    fontSize?: Record<string, unknown>;
    fontWeight?: Record<string, number>;
  };
  tokenMapping?: Record<string, string>;
}): DesignTokens {
  const { designTokens, tokenMapping = {} } = raw;

  // colors, spacing은 그대로 복사
  const colors = designTokens.colors || {};
  const spacing = designTokens.spacing || {};

  // borderRadius는 Tailwind 기본값 제공 (JSON에 없음)
  const borderRadius: Record<string, string> = {
    none: '0px',
    sm: '2px',
    DEFAULT: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    '2xl': '16px',
    full: '9999px',
  };

  // typography: fontSize + fontWeight 조합
  const typography: Record<string, { fontSize: string; lineHeight: string; fontWeight: string }> = {};
  const fontSizeMap = designTokens.fontSize || {};
  const fontWeightMap = designTokens.fontWeight || {};

  for (const key of Object.keys(fontSizeMap)) {
    const parsed = parseFontSize(fontSizeMap[key]);
    if (parsed) {
      const weight = fontWeightMap[key];
      // typography 키 변환: typography-body-lg-medium → text-body-lg-medium
      const typographyKey = key.replace(/^typography-/, 'text-');
      typography[typographyKey] = {
        fontSize: parsed.fontSize,
        lineHeight: parsed.lineHeight,
        fontWeight: weight !== undefined ? String(weight) : '400',
      };
    }
  }

  return { colors, spacing, borderRadius, typography, tokenMapping };
}

/**
 * 토큰 파일 로드 (design-tokens.json 형식 지원)
 *
 * 파일 탐색 우선순위:
 * 1. basePath/design-tokens.json (번들 내장 경로)
 * 2. basePath/src/tokens/design-tokens.json (packages/ui 구조)
 * 3. basePath/../tokens/design-tokens.json (실제 환경)
 * 4. basePath/tokens.json (레거시 호환)
 */
async function loadTokens(basePath: string): Promise<DesignTokens> {
  const searchPaths = [
    // 1순위: 번들 내장 경로
    path.join(basePath, 'design-tokens.json'),
    // 2순위: packages/ui 구조
    path.join(basePath, 'src', 'tokens', 'design-tokens.json'),
    // 3순위: 상위 tokens 디렉토리
    path.join(basePath, '..', 'tokens', 'design-tokens.json'),
    // 4순위: 레거시 호환
    path.join(basePath, 'tokens.json'),
  ];

  for (const tokenPath of searchPaths) {
    try {
      const content = await fs.readFile(tokenPath, 'utf-8');
      const rawData = JSON.parse(content);

      if (rawData.designTokens) {
        return convertDesignTokensJSON(rawData);
      }
      // 레거시 포맷: tokenMapping이 없으면 빈 객체 추가
      return { ...rawData, tokenMapping: rawData.tokenMapping || {} } as DesignTokens;
    } catch {
      // 다음 경로 시도
    }
  }

  throw new Error(
    `design-tokens.json을 찾을 수 없습니다.\n검색 경로:\n  ${searchPaths.join('\n  ')}`
  );
}
