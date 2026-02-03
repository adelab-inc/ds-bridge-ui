import type {
  FigmaNode,
  FigmaComponentMeta,
  FigmaNodesResponse,
  FigmaColor,
  LayoutSchema,
  LayoutNode,
  LayoutSize,
  LayoutPadding,
  LayoutTextStyle,
  SizeValue,
  ExtractedComponent,
  ExtractedStyles,
  TypographyInfo,
} from '@/types/layout-schema';

/**
 * 스타일 정보 수집기
 * 트리 순회 중 색상, 간격, 타이포그래피, 컴포넌트 정보를 누적
 */
interface StyleCollector {
  colors: Set<string>;
  spacings: Set<number>;
  typography: Map<string, TypographyInfo>;
  components: Map<string, { count: number; variants: Set<string> }>;
}

/**
 * Figma API 응답을 layout-schema.json으로 변환
 *
 * @param response - Figma API 노드 응답
 * @param nodeId - 대상 노드 ID
 * @param sourceUrl - 원본 Figma URL
 * @returns layout-schema.json 데이터
 */
export function extractLayoutSchema(
  response: FigmaNodesResponse,
  nodeId: string,
  sourceUrl: string
): LayoutSchema {
  const nodeData = response.nodes[nodeId];

  if (!nodeData) {
    throw new Error(`Node ${nodeId} not found in response`);
  }

  // 컴포넌트 메타 정보 맵 생성
  const componentsMap = buildComponentsMap(nodeData.components);

  // 스타일 수집기 초기화
  const collector = createStyleCollector();

  // 노드 트리 변환 (전체 깊이 순회)
  const layoutTree = transformNode(nodeData.document, componentsMap, collector);

  // 추출된 컴포넌트 목록 생성
  const components = buildExtractedComponents(collector.components);

  // 추출된 스타일 생성
  const styles = buildExtractedStyles(collector);

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceUrl,
    layout: layoutTree,
    extractedComponents: components,
    styles,
  };
}

/**
 * Figma 노드를 LayoutNode로 변환 (재귀적)
 *
 * ⚠️ 중요: 깊이 제한 없이 모든 자식 노드를 재귀 순회
 *
 * @param node - Figma 노드
 * @param componentsMap - 컴포넌트 메타 맵
 * @param collector - 스타일 수집기
 * @returns 변환된 레이아웃 노드
 */
function transformNode(
  node: FigmaNode,
  componentsMap: Map<string, FigmaComponentMeta>,
  collector: StyleCollector
): LayoutNode {
  const nodeType = node.type;

  // FRAME, GROUP, SECTION, COMPONENT, COMPONENT_SET 처리
  if (
    nodeType === 'FRAME' ||
    nodeType === 'GROUP' ||
    nodeType === 'SECTION' ||
    nodeType === 'COMPONENT' ||
    nodeType === 'COMPONENT_SET'
  ) {
    const result: LayoutNode = {
      name: node.name,
      type: node.type,
    };

    // layoutMode 추가 (NONE 제외)
    if (node.layoutMode && node.layoutMode !== 'NONE') {
      result.layoutMode = node.layoutMode;
    }

    // 크기 추가
    const size = resolveSize(node);
    if (size) {
      result.size = size;
    }

    // 패딩 추가 (0이 아닌 값이 있을 경우만)
    const padding = extractPadding(node);
    if (padding) {
      result.padding = padding;

      // 패딩 값을 spacing 컬렉션에 추가
      [padding.top, padding.right, padding.bottom, padding.left]
        .filter((v) => v > 0)
        .forEach((v) => collector.spacings.add(v));
    }

    // 아이템 간격 추가 (0보다 클 경우만)
    if (node.itemSpacing && node.itemSpacing > 0) {
      result.itemSpacing = node.itemSpacing;
      collector.spacings.add(node.itemSpacing);
    }

    // 자식 노드 재귀 변환 (깊이 제한 없음)
    if (node.children && node.children.length > 0) {
      result.children = node.children.map((child) =>
        transformNode(child, componentsMap, collector)
      );
    }

    // 색상 수집
    collectColors(node, collector);

    return result;
  }

  // TEXT 노드 처리
  if (nodeType === 'TEXT') {
    const result: LayoutNode = {
      name: node.name,
      type: 'TEXT',
    };

    if (node.characters) {
      result.text = node.characters;
    }

    const textStyle = extractTextStyle(node);
    if (textStyle) {
      result.textStyle = textStyle;

      // 타이포그래피 수집
      const key = `${textStyle.fontFamily || 'default'}-${textStyle.fontSize}-${textStyle.fontWeight}`;
      if (!collector.typography.has(key)) {
        collector.typography.set(key, {
          fontSize: textStyle.fontSize,
          fontWeight: textStyle.fontWeight,
          ...(textStyle.fontFamily && { fontFamily: textStyle.fontFamily }),
        });
      }

      // 텍스트 색상 수집
      if (textStyle.color) {
        collector.colors.add(textStyle.color);
      }
    }

    const size = resolveSize(node);
    if (size) {
      result.size = size;
    }

    return result;
  }

  // INSTANCE 노드 처리
  if (nodeType === 'INSTANCE') {
    const result: LayoutNode = {
      name: node.name,
      type: 'INSTANCE',
    };

    // 컴포넌트 이름 해결
    const componentName = resolveComponentName(node.componentId, componentsMap);
    if (componentName) {
      result.componentName = componentName;
    }

    // 컴포넌트 속성 추출
    const props = extractComponentProps(node);
    if (props && Object.keys(props).length > 0) {
      result.componentProps = props;
    }

    const size = resolveSize(node);
    if (size) {
      result.size = size;
    }

    // 자식 노드 재귀 변환 (인스턴스도 오버라이드된 자식을 가질 수 있음)
    if (node.children && node.children.length > 0) {
      result.children = node.children.map((child) =>
        transformNode(child, componentsMap, collector)
      );
    }

    // 컴포넌트 정보 수집
    const name = componentName || node.name;
    const existing = collector.components.get(name);
    if (existing) {
      existing.count++;

      // variants 추가 (componentProperties에서)
      if (node.componentProperties) {
        for (const [, prop] of Object.entries(node.componentProperties)) {
          if (prop.type === 'VARIANT') {
            existing.variants.add(prop.value);
          }
        }
      }
    } else {
      const variants = new Set<string>();
      if (node.componentProperties) {
        for (const [, prop] of Object.entries(node.componentProperties)) {
          if (prop.type === 'VARIANT') {
            variants.add(prop.value);
          }
        }
      }
      collector.components.set(name, { count: 1, variants });
    }

    // 색상 수집
    collectColors(node, collector);

    return result;
  }

  // 기타 모든 노드 타입 (RECTANGLE, ELLIPSE, LINE, VECTOR, BOOLEAN_OPERATION 등)
  const result: LayoutNode = {
    name: node.name,
    type: node.type,
  };

  const size = resolveSize(node);
  if (size) {
    result.size = size;
  }

  // 색상 수집
  collectColors(node, collector);

  // 자식 노드가 있으면 재귀 변환
  if (node.children && node.children.length > 0) {
    result.children = node.children.map((child) =>
      transformNode(child, componentsMap, collector)
    );
  }

  return result;
}

/**
 * 노드의 크기 해결
 *
 * @param node - Figma 노드
 * @returns 레이아웃 크기 (width/height가 모두 없으면 undefined)
 */
function resolveSize(node: FigmaNode): LayoutSize | undefined {
  const width = resolveSizeValue(node, 'width');
  const height = resolveSizeValue(node, 'height');

  if (width === undefined && height === undefined) {
    return undefined;
  }

  return {
    width: width ?? 0,
    height: height ?? 0,
  };
}

/**
 * 축별 크기 값 해결
 *
 * layoutMode에 따라 primary/counter 축 판단 후
 * layoutGrow, layoutAlign, sizingMode를 체크하여
 * 'FILL', 'HUG', 또는 고정 픽셀 값 반환
 *
 * @param node - Figma 노드
 * @param axis - 'width' 또는 'height'
 * @returns 크기 값
 */
function resolveSizeValue(
  node: FigmaNode,
  axis: 'width' | 'height'
): SizeValue | undefined {
  const isPrimaryAxis =
    (axis === 'width' && node.layoutMode === 'HORIZONTAL') ||
    (axis === 'height' && node.layoutMode === 'VERTICAL');

  const isCounterAxis =
    (axis === 'width' && node.layoutMode === 'VERTICAL') ||
    (axis === 'height' && node.layoutMode === 'HORIZONTAL');

  // layoutGrow === 1 → FILL
  if (node.layoutGrow === 1) {
    return 'FILL';
  }

  // Counter axis에서 layoutAlign === 'STRETCH' → FILL
  if (isCounterAxis && node.layoutAlign === 'STRETCH') {
    return 'FILL';
  }

  // Sizing mode 체크
  const sizingMode = isPrimaryAxis
    ? node.primaryAxisSizingMode
    : node.counterAxisSizingMode;

  if (sizingMode === 'HUG') {
    return 'HUG';
  }

  if (sizingMode === 'FILL') {
    return 'FILL';
  }

  // FIXED 또는 기본값 → absoluteBoundingBox 사용
  if (node.absoluteBoundingBox) {
    const dimension =
      axis === 'width'
        ? node.absoluteBoundingBox.width
        : node.absoluteBoundingBox.height;

    return Math.round(dimension);
  }

  return undefined;
}

/**
 * 패딩 추출
 *
 * @param node - Figma 노드
 * @returns 패딩 (모두 0이면 undefined)
 */
function extractPadding(node: FigmaNode): LayoutPadding | undefined {
  const top = node.paddingTop ?? 0;
  const right = node.paddingRight ?? 0;
  const bottom = node.paddingBottom ?? 0;
  const left = node.paddingLeft ?? 0;

  // 모두 0이면 undefined
  if (top === 0 && right === 0 && bottom === 0 && left === 0) {
    return undefined;
  }

  return { top, right, bottom, left };
}

/**
 * 텍스트 스타일 추출
 *
 * @param node - Figma 노드
 * @returns 텍스트 스타일 (fontSize가 없으면 undefined)
 */
function extractTextStyle(node: FigmaNode): LayoutTextStyle | undefined {
  if (!node.style) {
    return undefined;
  }

  const { fontSize, fontWeight, fontFamily, textAlignHorizontal, lineHeightPx } =
    node.style;

  if (fontSize === undefined) {
    return undefined;
  }

  const textStyle: LayoutTextStyle = {
    fontSize,
    fontWeight: fontWeight ?? 400,
  };

  if (fontFamily !== undefined) {
    textStyle.fontFamily = fontFamily;
  }

  if (textAlignHorizontal !== undefined) {
    textStyle.textAlign = textAlignHorizontal.toLowerCase() as 'left' | 'center' | 'right';
  }

  if (lineHeightPx !== undefined) {
    textStyle.lineHeight = lineHeightPx;
  }

  // 색상 추출 (fills[0]이 SOLID인 경우)
  if (node.fills && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID' && fill.color) {
      textStyle.color = rgbaToHex(fill.color);
    }
  }

  return textStyle;
}

/**
 * RGBA 색상을 HEX로 변환
 *
 * @param color - Figma 색상 (0-1 범위)
 * @returns HEX 색상 문자열 (#RRGGBB)
 */
function rgbaToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.round(color.g * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.round(color.b * 255)
    .toString(16)
    .padStart(2, '0');

  return `#${r}${g}${b}`.toUpperCase();
}

/**
 * 컴포넌트 ID로 컴포넌트 이름 해결
 *
 * @param componentId - 컴포넌트 ID
 * @param componentsMap - 컴포넌트 메타 맵
 * @returns 컴포넌트 이름 (없으면 undefined)
 */
function resolveComponentName(
  componentId: string | undefined,
  componentsMap: Map<string, FigmaComponentMeta>
): string | undefined {
  if (!componentId) {
    return undefined;
  }

  const meta = componentsMap.get(componentId);
  return meta?.name;
}

/**
 * 컴포넌트 속성 추출
 *
 * @param node - Figma 노드
 * @returns 컴포넌트 속성 객체 (없으면 undefined)
 */
function extractComponentProps(
  node: FigmaNode
): Record<string, string> | undefined {
  if (!node.componentProperties) {
    return undefined;
  }

  const props: Record<string, string> = {};

  for (const [key, prop] of Object.entries(node.componentProperties)) {
    props[key] = prop.value;
  }

  return Object.keys(props).length > 0 ? props : undefined;
}

/**
 * 노드의 fill 색상 수집
 *
 * @param node - Figma 노드
 * @param collector - 스타일 수집기
 */
function collectColors(node: FigmaNode, collector: StyleCollector): void {
  if (!node.fills) {
    return;
  }

  for (const fill of node.fills) {
    if (fill.type === 'SOLID' && fill.color) {
      const hex = rgbaToHex(fill.color);
      collector.colors.add(hex);
    }
  }
}

/**
 * 컴포넌트 Record를 Map으로 변환
 *
 * @param components - 컴포넌트 메타 레코드
 * @returns 컴포넌트 메타 맵
 */
function buildComponentsMap(
  components: Record<string, FigmaComponentMeta>
): Map<string, FigmaComponentMeta> {
  return new Map(Object.entries(components));
}

/**
 * 스타일 수집기 생성
 *
 * @returns 초기화된 스타일 수집기
 */
function createStyleCollector(): StyleCollector {
  return {
    colors: new Set(),
    spacings: new Set(),
    typography: new Map(),
    components: new Map(),
  };
}

/**
 * 컴포넌트 맵을 ExtractedComponent 배열로 변환
 *
 * @param map - 컴포넌트 수집 맵
 * @returns 추출된 컴포넌트 배열 (사용 횟수 내림차순)
 */
function buildExtractedComponents(
  map: Map<string, { count: number; variants: Set<string> }>
): ExtractedComponent[] {
  const components = Array.from(map.entries()).map(([name, { count, variants }]) => ({
    name,
    instances: count,
    variants: Array.from(variants).sort(),
  }));

  // 사용 횟수 내림차순 정렬
  components.sort((a, b) => b.instances - a.instances);

  return components;
}

/**
 * 수집된 스타일을 ExtractedStyles로 변환
 *
 * @param collector - 스타일 수집기
 * @returns 추출된 스타일
 */
function buildExtractedStyles(collector: StyleCollector): ExtractedStyles {
  // 색상 정렬
  const colors = Array.from(collector.colors).sort();

  // 간격 정렬
  const spacing = Array.from(collector.spacings).sort((a, b) => a - b);

  // 타이포그래피 변환
  const typography: Record<string, TypographyInfo> = {};
  const usedNames = new Set<string>();

  for (const [, info] of collector.typography) {
    let name = generateTypographyName(info);

    // 중복 이름 처리 (fontWeight 추가)
    if (usedNames.has(name)) {
      name = `${name}-${info.fontWeight}`;
    }

    usedNames.add(name);
    typography[name] = info;
  }

  return {
    colors,
    spacing,
    typography,
  };
}

/**
 * 타이포그래피 정보로부터 의미 있는 이름 생성
 *
 * @param info - 타이포그래피 정보
 * @returns 생성된 이름
 */
function generateTypographyName(info: TypographyInfo): string {
  const fontSize = info.fontSize;

  // fontSize 기준 분류
  if (fontSize >= 20) {
    return `heading-${fontSize}`;
  }

  if (fontSize >= 16) {
    return `subtitle-${fontSize}`;
  }

  return `body-${fontSize}`;
}
