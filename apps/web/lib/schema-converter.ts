/**
 * Schema Converter
 *
 * ds.json ↔ component-schema.json 변환 유틸리티
 */

import type {
  DSJson,
  DSComponent,
  PropInfo,
  StoryInfo,
  ComponentSchemaJson,
  LegacyComponentSchema,
  LegacyPropSchema,
  LegacyStorySchema,
} from '@/types/ds-extraction';

// =============================================================================
// ds.json → component-schema.json 변환
// =============================================================================

/**
 * ds.json을 legacy component-schema.json 형식으로 변환
 */
export function convertDSToLegacy(ds: DSJson): ComponentSchemaJson {
  const components: Record<string, LegacyComponentSchema> = {};

  for (const comp of ds.components) {
    components[comp.name] = convertComponent(comp);
  }

  return {
    version: ds.version,
    generatedAt: ds.extractedAt,
    components,
  };
}

/**
 * DSComponent를 LegacyComponentSchema로 변환
 */
function convertComponent(comp: DSComponent): LegacyComponentSchema {
  const props: Record<string, LegacyPropSchema> = {};

  for (const prop of comp.props) {
    props[prop.name] = convertProp(prop);
  }

  const stories: LegacyStorySchema[] = comp.stories.map((story) => ({
    id: story.id,
    name: story.name,
  }));

  return {
    displayName: comp.name,
    filePath: '', // Public URL 추출에서는 파일 경로 없음
    category: comp.category,
    props,
    stories,
  };
}

/**
 * PropInfo를 LegacyPropSchema로 변환
 */
function convertProp(prop: PropInfo): LegacyPropSchema {
  return {
    type: prop.type.length === 1 ? prop.type[0] : prop.type,
    required: prop.required,
    defaultValue: prop.defaultValue ?? undefined,
    description: prop.description ?? undefined,
  };
}

/**
 * 스토리 ID 생성 (컴포넌트명--스토리명)
 */
function generateStoryId(componentName: string, storyName: string): string {
  const normalizedComponent = componentName.toLowerCase().replace(/\s+/g, '-');
  const normalizedStory = storyName.toLowerCase().replace(/\s+/g, '-');
  return `${normalizedComponent}--${normalizedStory}`;
}

// =============================================================================
// component-schema.json → ds.json 변환
// =============================================================================

/**
 * legacy component-schema.json을 ds.json 형식으로 변환
 */
export function convertLegacyToDS(
  legacy: ComponentSchemaJson,
  name: string,
  source: string
): DSJson {
  const components: DSComponent[] = [];

  for (const [componentName, comp] of Object.entries(legacy.components)) {
    components.push(convertLegacyComponent(componentName, comp));
  }

  return {
    name,
    source,
    version: legacy.version,
    extractedAt: legacy.generatedAt,
    components,
  };
}

/**
 * LegacyComponentSchema를 DSComponent로 변환
 */
function convertLegacyComponent(
  componentName: string,
  comp: LegacyComponentSchema
): DSComponent {
  const props: PropInfo[] = [];

  for (const [propName, propSchema] of Object.entries(comp.props)) {
    props.push(convertLegacyProp(propName, propSchema));
  }

  const stories = comp.stories.map((s) => ({ id: s.id, name: s.name }));

  return {
    name: componentName,
    category: comp.category,
    stories,
    props,
  };
}

/**
 * LegacyPropSchema를 PropInfo로 변환
 */
function convertLegacyProp(propName: string, prop: LegacyPropSchema): PropInfo {
  // 타입을 배열로 정규화
  const type = Array.isArray(prop.type) ? prop.type : [prop.type];

  // control 타입 추론
  const control = inferControlType(type, prop.defaultValue);

  // options 추출 (enum/union 타입인 경우)
  const options = isEnumType(type) ? type : null;

  return {
    name: propName,
    description: prop.description ?? null,
    type,
    defaultValue: stringifyDefaultValue(prop.defaultValue),
    required: prop.required,
    control,
    options,
  };
}

/**
 * 타입에서 control 타입 추론
 */
function inferControlType(
  type: string[],
  defaultValue?: unknown
): PropInfo['control'] {
  // 단일 타입인 경우
  if (type.length === 1) {
    const t = type[0].toLowerCase();

    if (t === 'string') return 'text';
    if (t === 'number') return 'number';
    if (t === 'boolean') return 'boolean';
    if (t.includes('object') || t.includes('record') || t.includes('{}')) {
      return 'object';
    }
    if (t.includes('[]') || t.includes('array')) {
      return 'object';
    }
    if (t.includes('node') || t.includes('element') || t.includes('react')) {
      return null; // React 타입은 control 없음
    }
  }

  // 여러 값이면 enum/union → select
  if (type.length > 1 && isEnumType(type)) {
    return 'select';
  }

  // boolean 기본값이면 boolean
  if (typeof defaultValue === 'boolean') {
    return 'boolean';
  }

  return null;
}

/**
 * enum/union 타입인지 확인 (리터럴 값 배열)
 */
function isEnumType(type: string[]): boolean {
  if (type.length <= 1) return false;

  // 모든 값이 짧은 문자열이면 enum으로 간주
  return type.every((t) => {
    // 일반적인 타입명이 아닌 경우 (예: "primary", "secondary")
    const commonTypes = ['string', 'number', 'boolean', 'object', 'undefined', 'null'];
    return !commonTypes.includes(t.toLowerCase()) && t.length < 30;
  });
}

/**
 * 기본값을 문자열로 변환
 */
function stringifyDefaultValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
