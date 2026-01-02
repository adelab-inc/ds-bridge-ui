/**
 * Tool 응답 포맷팅 유틸리티
 * 사람이 읽기 좋은 자연어 형태로 변환
 */
import type {
  GetImplementedStyleOutput,
  ListComponentsOutput,
} from '../types';

export interface FormatStyleOptions {
  property?: string; // 특정 속성만 표시
}

/**
 * 컴포넌트명 첫 글자 대문자 변환
 */
function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 헤더 라인 생성: "{Component} {variant} {size}"
 * 빈 값은 제외하고 공백으로 연결
 */
function buildHeaderParts(
  component: string,
  variant: string,
  size: string
): string {
  const parts = [capitalize(component)];

  if (variant) {
    parts.push(variant);
  }

  if (size) {
    parts.push(size);
  }

  return parts.join(' ');
}

/**
 * get_implemented_style 응답 포맷팅
 *
 * @example 전체 스타일
 * 📐 Button primary md
 *
 * backgroundColor: #0033A0
 * color: #FFFFFF
 *
 * @example 특정 속성만
 * Button primary md padding: 8px 16px
 */
export function formatComponentStyle(
  data: GetImplementedStyleOutput,
  options?: FormatStyleOptions
): string {
  const header = buildHeaderParts(data.component, data.variant, data.size);

  // 특정 속성만 조회하는 경우 (한 줄 포맷)
  if (options?.property) {
    const value = data.styles[options.property] ?? '(없음)';
    return `${header} ${options.property}: ${value}`;
  }

  // 전체 스타일 포맷 (여러 줄)
  const lines = [`📐 ${header}`, ''];

  const styleKeys = Object.keys(data.styles);

  if (styleKeys.length === 0) {
    lines.push('(스타일 없음)');
  } else {
    for (const key of styleKeys) {
      lines.push(`${key}: ${data.styles[key]}`);
    }
  }

  return lines.join('\n');
}

/**
 * list_components 응답 포맷팅
 *
 * @example
 * 📦 컴포넌트 목록 (3개)
 *
 * • button: primary, secondary | sm, md, lg
 * • badge: solid, subtle | sm, md
 */
export function formatComponentList(data: ListComponentsOutput): string {
  const lines = [`📦 컴포넌트 목록 (${data.total}개)`, ''];

  if (data.components.length === 0) {
    lines.push('(없음)');
    return lines.join('\n');
  }

  for (const comp of data.components) {
    const parts: string[] = [];

    // variants 추가
    if (comp.variants.length > 0) {
      parts.push(comp.variants.join(', '));
    }

    // sizes 추가
    if (comp.sizes.length > 0) {
      parts.push(comp.sizes.join(', '));
    }

    // 조합
    if (parts.length === 0) {
      // variants/sizes 모두 없음
      lines.push(`• ${comp.name}`);
    } else if (parts.length === 1) {
      // variants만 또는 sizes만 있음
      lines.push(`• ${comp.name}: ${parts[0]}`);
    } else {
      // 둘 다 있음 - | 로 구분
      lines.push(`• ${comp.name}: ${parts[0]} | ${parts[1]}`);
    }
  }

  return lines.join('\n');
}
