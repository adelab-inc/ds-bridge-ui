/**
 * TailwindCSS 클래스를 실제 CSS 값으로 변환하는 ClassResolver
 * 디자인 토큰 기반으로 클래스명을 CSS 속성으로 매핑
 */
import type { DesignTokens, ResolvedStyles } from '../types';
import { formatStyleValue } from '../types';

/**
 * 상태별 스타일 결과 타입
 */
export interface StateStyles {
  default?: ResolvedStyles;
  hover?: ResolvedStyles;
  'focus-visible'?: ResolvedStyles;
  active?: ResolvedStyles;
  [state: string]: ResolvedStyles | undefined;
}

/**
 * Ring 스타일 컨텍스트 (box-shadow 생성용)
 */
interface RingContext {
  width: number;
  inset: boolean;
  color: string | null;
}

export class ClassResolver {
  private tokens: DesignTokens;

  constructor(tokens: DesignTokens) {
    this.tokens = tokens;
  }

  /**
   * 토큰 키로 Figma 토큰 이름 조회
   */
  private getTokenName(tokenKey: string): string | undefined {
    return this.tokens.tokenMapping?.[tokenKey];
  }

  /**
   * 값과 토큰 이름을 포맷팅 (예: "color/role/text/primary (#212529)")
   */
  private formatValue(value: string, tokenKey: string): string {
    const tokenName = this.getTokenName(tokenKey);
    return formatStyleValue(value, tokenName);
  }

  /**
   * TailwindCSS 클래스 배열을 CSS 스타일 객체로 변환
   */
  resolve(classes: string[]): ResolvedStyles {
    const styles: ResolvedStyles = {};

    // ring 클래스들을 수집하여 box-shadow로 변환
    const ringClasses = classes.filter((c) => c.startsWith('ring-'));
    if (ringClasses.length > 0) {
      const boxShadow = this.resolveRingClasses(ringClasses);
      if (boxShadow) {
        styles.boxShadow = boxShadow;
      }
    }

    for (const className of classes) {
      // ring 클래스는 별도 처리했으므로 건너뜀
      if (className.startsWith('ring-')) continue;

      const resolved = this.resolveClass(className);
      Object.assign(styles, resolved);
    }

    return styles;
  }

  /**
   * 상태별로 스타일 분리 (hover:, focus-visible:, active: 등)
   */
  resolveWithStates(classes: string[]): StateStyles {
    const result: StateStyles = {};
    const stateClasses: Record<string, string[]> = {
      default: [],
    };

    // 클래스들을 상태별로 분류
    for (const className of classes) {
      const stateMatch = className.match(/^(hover|focus-visible|focus|active):(.+)$/);
      if (stateMatch) {
        const [, state, baseClass] = stateMatch;
        if (!stateClasses[state]) {
          stateClasses[state] = [];
        }
        stateClasses[state].push(baseClass);
      } else {
        stateClasses.default.push(className);
      }
    }

    // 각 상태별로 스타일 해석
    for (const [state, stateClassList] of Object.entries(stateClasses)) {
      if (stateClassList.length > 0) {
        result[state] = this.resolve(stateClassList);
      }
    }

    return result;
  }

  /**
   * 특정 상태의 스타일만 조회
   */
  getStateStyles(classes: string[], state: string): ResolvedStyles {
    const statePrefix = `${state}:`;
    const stateClasses: string[] = [];

    for (const className of classes) {
      if (className.startsWith(statePrefix)) {
        stateClasses.push(className.slice(statePrefix.length));
      }
    }

    if (stateClasses.length === 0) {
      return {};
    }

    return this.resolve(stateClasses);
  }

  /**
   * 단일 클래스를 CSS 스타일로 변환
   */
  private resolveClass(className: string): ResolvedStyles {
    // Width: w-{value}
    if (className.startsWith('w-')) {
      return this.resolveWidth(className);
    }

    // Height: h-{value}
    if (className.startsWith('h-')) {
      return this.resolveHeight(className);
    }

    // Min/Max Width/Height
    if (className.startsWith('min-w-')) {
      return this.resolveMinWidth(className);
    }
    if (className.startsWith('max-w-')) {
      return this.resolveMaxWidth(className);
    }
    if (className.startsWith('min-h-')) {
      return this.resolveMinHeight(className);
    }
    if (className.startsWith('max-h-')) {
      return this.resolveMaxHeight(className);
    }

    // 배경색: bg-{token}
    if (className.startsWith('bg-')) {
      return this.resolveBackgroundColor(className);
    }

    // 텍스트 색상 또는 타이포그래피: text-{token}
    if (className.startsWith('text-')) {
      return this.resolveTextOrTypography(className);
    }

    // 패딩: p-, px-, py-, pt-, pr-, pb-, pl-
    if (this.isPaddingClass(className)) {
      return this.resolvePadding(className);
    }

    // Gap: gap-{token}
    if (className.startsWith('gap-')) {
      return this.resolveGap(className);
    }

    // Border radius: rounded-{size}
    if (className.startsWith('rounded-')) {
      return this.resolveBorderRadius(className);
    }

    // Border: border (width) 또는 border-{color}
    if (className === 'border' || className.startsWith('border-')) {
      return this.resolveBorder(className);
    }

    // outline-none 특수 처리
    if (className === 'outline-none') {
      return { outline: 'none' };
    }

    // outline (단독) → outlineStyle: solid
    if (className === 'outline') {
      return { outlineStyle: 'solid' };
    }

    // Outline offset: outline-offset-{value}
    if (className.startsWith('outline-offset-')) {
      return this.resolveOutlineOffset(className);
    }

    // Outline width 또는 color: outline-{token}
    if (className.startsWith('outline-')) {
      return this.resolveOutline(className);
    }

    // Flex shorthand: flex-1, flex-auto, flex-none, flex-initial
    if (this.isFlexShorthand(className)) {
      return this.resolveFlexShorthand(className);
    }

    // Flex shrink/grow: shrink, shrink-0, grow, grow-0, flex-shrink-*, flex-grow-*
    if (this.isFlexShrinkGrow(className)) {
      return this.resolveFlexShrinkGrow(className);
    }

    // Flexbox 유틸리티
    if (this.isFlexboxClass(className)) {
      return this.resolveFlexbox(className);
    }

    // Box Shadow: shadow-{size}
    if (className === 'shadow' || className.startsWith('shadow-')) {
      return this.resolveShadow(className);
    }

    // Cursor: cursor-{type}
    if (className.startsWith('cursor-')) {
      return this.resolveCursor(className);
    }

    // Self Align: self-{value}
    if (className.startsWith('self-')) {
      return this.resolveSelf(className);
    }

    // Opacity: opacity-{value}
    if (className.startsWith('opacity-')) {
      return this.resolveOpacity(className);
    }

    // Transition: transition-{type}
    if (className === 'transition' || className.startsWith('transition-')) {
      return this.resolveTransition(className);
    }

    // Duration: duration-{value}
    if (className.startsWith('duration-')) {
      return this.resolveDuration(className);
    }

    // ============================================
    // Phase 3: 저빈도/복잡 클래스 (3순위)
    // ============================================

    // Position: relative, absolute, fixed, sticky, static
    if (this.isPositionClass(className)) {
      return this.resolvePosition(className);
    }

    // Inset: inset-{value}, inset-x-{value}, inset-y-{value}
    if (className.startsWith('inset-')) {
      return this.resolveInset(className);
    }

    // Top/Right/Bottom/Left: top-{value}, right-{value}, bottom-{value}, left-{value}
    if (this.isPositionOffset(className)) {
      return this.resolvePositionOffset(className);
    }

    // Overflow: overflow-{value}, overflow-x-{value}, overflow-y-{value}
    if (className.startsWith('overflow-')) {
      return this.resolveOverflow(className);
    }

    // Text Decoration: underline, no-underline, line-through, overline
    if (this.isTextDecoration(className)) {
      return this.resolveTextDecoration(className);
    }

    // Underline Offset: underline-offset-{value}
    if (className.startsWith('underline-offset-')) {
      return this.resolveUnderlineOffset(className);
    }

    // Whitespace: whitespace-{value}
    if (className.startsWith('whitespace-')) {
      return this.resolveWhitespace(className);
    }

    // Z-Index: z-{value}
    if (className.startsWith('z-')) {
      return this.resolveZIndex(className);
    }

    // Margin: m-, mx-, my-, mt-, mr-, mb-, ml-
    if (this.isMarginClass(className)) {
      return this.resolveMargin(className);
    }

    return {};
  }

  /**
   * ring 클래스들을 box-shadow로 변환
   * ring-{width}, ring-inset, ring-{color} 조합 처리
   */
  private resolveRingClasses(ringClasses: string[]): string | null {
    // ring 컨텍스트 분석
    const contexts: RingContext[] = [];
    let currentContext: RingContext = { width: 3, inset: false, color: null }; // Tailwind 기본 ring 두께

    for (const ringClass of ringClasses) {
      // ring-0: 비활성화
      if (ringClass === 'ring-0') {
        return 'none';
      }

      // ring-{width}: 두께 지정
      const widthMatch = ringClass.match(/^ring-(\d+)$/);
      if (widthMatch) {
        // 이전 컨텍스트가 색상이 있으면 저장하고 새 컨텍스트 시작
        if (currentContext.color) {
          contexts.push({ ...currentContext });
          currentContext = { width: parseInt(widthMatch[1], 10), inset: false, color: null };
        } else {
          currentContext.width = parseInt(widthMatch[1], 10);
        }
        continue;
      }

      // ring-inset: 내부 그림자
      if (ringClass === 'ring-inset') {
        currentContext.inset = true;
        continue;
      }

      // ring-{color}: 색상
      const colorKey = ringClass.replace(/^ring-/, '');
      const color = this.tokens.colors[colorKey];
      if (color) {
        currentContext.color = color;
        // 색상이 지정되면 현재 컨텍스트 저장
        contexts.push({ ...currentContext });
        currentContext = { width: 3, inset: false, color: null };
      }
    }

    // 마지막 컨텍스트에 색상 없으면 기본 색상 사용
    if (currentContext.color === null && contexts.length === 0 && ringClasses.length > 0) {
      // ring만 있고 색상이 없는 경우, 기본 색상(#0033a0) 사용
      currentContext.color = this.tokens.colors['focus'] || '#3b82f6';
      contexts.push(currentContext);
    }

    if (contexts.length === 0) {
      return null;
    }

    // box-shadow 문자열 생성
    const shadows = contexts.map((ctx) => {
      const insetPrefix = ctx.inset ? 'inset ' : '';
      return `${insetPrefix}0 0 0 ${ctx.width}px ${ctx.color}`;
    });

    return shadows.join(', ');
  }

  /**
   * 배경색 변환: bg-bg-accent → backgroundColor: color/role/bg/accent (#0033a0)
   */
  private resolveBackgroundColor(className: string): ResolvedStyles {
    // bg-bg-accent → bg-accent 토큰 조회
    const tokenKey = className.replace(/^bg-/, '');
    const color = this.tokens.colors[tokenKey];

    if (color) {
      return { backgroundColor: this.formatValue(color, tokenKey) };
    }

    return {};
  }

  /**
   * 텍스트 색상 또는 타이포그래피 변환
   */
  private resolveTextOrTypography(className: string): ResolvedStyles {
    // 먼저 타이포그래피 체크
    const typography = this.tokens.typography[className];
    if (typography) {
      // 타이포그래피 토큰 키: text-body-lg-medium → typography-body-lg-medium
      const typographyTokenKey = className.replace(/^text-/, 'typography-');
      const tokenName = this.getTokenName(typographyTokenKey);

      return {
        fontSize: tokenName ? `${tokenName} (${typography.fontSize})` : typography.fontSize,
        lineHeight: typography.lineHeight,
        fontWeight: typography.fontWeight,
      };
    }

    // 텍스트 색상: text-text-primary → text-primary 토큰 조회
    const tokenKey = className.replace(/^text-/, '');
    const color = this.tokens.colors[tokenKey];

    if (color) {
      return { color: this.formatValue(color, tokenKey) };
    }

    return {};
  }

  /**
   * 패딩 클래스인지 확인
   */
  private isPaddingClass(className: string): boolean {
    return /^p[xytblr]?-/.test(className);
  }

  /**
   * 패딩 변환
   */
  private resolvePadding(className: string): ResolvedStyles {
    const match = className.match(/^(p[xytblr]?)-(.+)$/);
    if (!match) return {};

    const [, prefix, value] = match;

    // Arbitrary value: p-[10px], px-[20px] 등
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    let formatted: string;
    if (arbitraryMatch) {
      formatted = arbitraryMatch[1];
    } else {
      const resolved = this.resolveSpacingWithToken(value);
      if (!resolved.spacing) return {};
      formatted = resolved.formatted;
    }

    switch (prefix) {
      case 'p':
        return { padding: formatted };
      case 'px':
        return { paddingLeft: formatted, paddingRight: formatted };
      case 'py':
        return { paddingTop: formatted, paddingBottom: formatted };
      case 'pt':
        return { paddingTop: formatted };
      case 'pr':
        return { paddingRight: formatted };
      case 'pb':
        return { paddingBottom: formatted };
      case 'pl':
        return { paddingLeft: formatted };
      /* v8 ignore next 3 */
      // 도달 불가능: regex로 이미 p, px, py, pt, pr, pb, pl만 허용
      default:
        return {};
    }
  }

  /**
   * Gap 변환
   */
  private resolveGap(className: string): ResolvedStyles {
    const value = className.replace(/^gap-/, '');

    // Arbitrary value: gap-[10px]
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return { gap: arbitraryMatch[1] };
    }

    const { spacing, formatted } = this.resolveSpacingWithToken(value);

    if (spacing) {
      return { gap: formatted };
    }

    return {};
  }

  /**
   * 간격 값 조회 (토큰 또는 숫자 기반) - 토큰 이름 포함
   */
  private resolveSpacingWithToken(value: string): { spacing: string | null; formatted: string } {
    // 토큰 기반: component-inset-button-y
    if (this.tokens.spacing[value]) {
      const spacing = this.tokens.spacing[value];
      const tokenName = this.getTokenName(value);
      return {
        spacing,
        formatted: tokenName ? `${tokenName} (${spacing})` : spacing,
      };
    }

    // 숫자 기반: 4 → 16px (Tailwind 기본 4px 단위)
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      // Tailwind 기본 스케일: 1 = 4px
      const spacing = `${numValue * 4}px`;
      // 숫자 기반 스케일도 tokenMapping에서 조회
      const tokenName = this.getTokenName(String(numValue));
      return {
        spacing,
        formatted: tokenName ? `${tokenName} (${spacing})` : spacing,
      };
    }

    return { spacing: null, formatted: '' };
  }

  /**
   * Border radius 변환
   */
  private resolveBorderRadius(className: string): ResolvedStyles {
    const size = className.replace(/^rounded-/, '') || 'DEFAULT';

    // Arbitrary value: rounded-[6px]
    const arbitraryMatch = size.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return { borderRadius: arbitraryMatch[1] };
    }

    const radius = this.tokens.borderRadius[size];

    if (radius) {
      return { borderRadius: radius };
    }

    return {};
  }

  /**
   * Border 변환 (width 또는 color)
   */
  private resolveBorder(className: string): ResolvedStyles {
    // border (단독) → borderWidth: 1px
    if (className === 'border') {
      return { borderWidth: '1px' };
    }

    const value = className.replace(/^border-/, '');

    // Arbitrary value: border-[3px]
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return { borderWidth: arbitraryMatch[1] };
    }

    // Border width: border-0, border-2, border-4, border-8
    const widthMatch = value.match(/^(\d+)$/);
    if (widthMatch) {
      return { borderWidth: `${widthMatch[1]}px` };
    }

    // Border color: border-{token}
    const color = this.tokens.colors[value];
    if (color) {
      return { borderColor: this.formatValue(color, value) };
    }

    return {};
  }

  /**
   * Outline 변환 (width 또는 color)
   */
  private resolveOutline(className: string): ResolvedStyles {
    const value = className.replace(/^outline-/, '');

    // Arbitrary value: outline-[3px]
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return { outlineWidth: arbitraryMatch[1] };
    }

    // Outline width: outline-1, outline-2, outline-4, outline-8
    const widthMatch = value.match(/^(\d+)$/);
    if (widthMatch) {
      return { outlineWidth: `${widthMatch[1]}px` };
    }

    // Outline color: outline-{token}
    const color = this.tokens.colors[value];
    if (color) {
      return { outlineColor: this.formatValue(color, value) };
    }

    return {};
  }

  /**
   * Outline offset 변환
   */
  private resolveOutlineOffset(className: string): ResolvedStyles {
    const value = className.replace(/^outline-offset-/, '');

    // Arbitrary value: outline-offset-[4px], outline-offset-[-2px]
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return { outlineOffset: arbitraryMatch[1] };
    }

    // Numeric value: outline-offset-0, outline-offset-2, outline-offset-4
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      return { outlineOffset: `${numValue}px` };
    }

    return {};
  }

  /**
   * Flexbox 클래스인지 확인
   */
  private isFlexboxClass(className: string): boolean {
    return [
      'flex',
      'inline-flex',
      'flex-row',
      'flex-row-reverse',
      'flex-col',
      'flex-col-reverse',
      'flex-wrap',
      'flex-nowrap',
      'flex-wrap-reverse',
      'justify-center',
      'justify-start',
      'justify-end',
      'justify-between',
      'items-center',
      'items-start',
      'items-end',
    ].includes(className);
  }

  /**
   * Flexbox 유틸리티 변환
   */
  private resolveFlexbox(className: string): ResolvedStyles {
    const flexboxMap: Record<string, ResolvedStyles> = {
      flex: { display: 'flex' },
      'inline-flex': { display: 'inline-flex' },
      'flex-row': { flexDirection: 'row' },
      'flex-row-reverse': { flexDirection: 'row-reverse' },
      'flex-col': { flexDirection: 'column' },
      'flex-col-reverse': { flexDirection: 'column-reverse' },
      'flex-wrap': { flexWrap: 'wrap' },
      'flex-nowrap': { flexWrap: 'nowrap' },
      'flex-wrap-reverse': { flexWrap: 'wrap-reverse' },
      'justify-center': { justifyContent: 'center' },
      'justify-start': { justifyContent: 'flex-start' },
      'justify-end': { justifyContent: 'flex-end' },
      'justify-between': { justifyContent: 'space-between' },
      'items-center': { alignItems: 'center' },
      'items-start': { alignItems: 'flex-start' },
      'items-end': { alignItems: 'flex-end' },
    };

    /* v8 ignore next 2 */
    // 도달 불가능: isFlexboxClass가 이미 유효한 클래스만 허용
    return flexboxMap[className] || {};
  }

  /**
   * Flex shorthand 클래스인지 확인 (flex-1, flex-auto, flex-none, flex-initial)
   */
  private isFlexShorthand(className: string): boolean {
    return ['flex-1', 'flex-auto', 'flex-none', 'flex-initial'].includes(className);
  }

  /**
   * Flex shorthand 변환
   */
  private resolveFlexShorthand(className: string): ResolvedStyles {
    const flexShorthandMap: Record<string, ResolvedStyles> = {
      'flex-1': { flex: '1 1 0%' },
      'flex-auto': { flex: '1 1 auto' },
      'flex-none': { flex: 'none' },
      'flex-initial': { flex: '0 1 auto' },
    };

    return flexShorthandMap[className] || {};
  }

  /**
   * Flex shrink/grow 클래스인지 확인
   */
  private isFlexShrinkGrow(className: string): boolean {
    return (
      className === 'shrink' ||
      className === 'shrink-0' ||
      className === 'grow' ||
      className === 'grow-0' ||
      className.startsWith('flex-shrink-') ||
      className.startsWith('flex-grow-')
    );
  }

  /**
   * Flex shrink/grow 변환
   */
  private resolveFlexShrinkGrow(className: string): ResolvedStyles {
    // shrink, shrink-0
    if (className === 'shrink') {
      return { flexShrink: '1' };
    }
    if (className === 'shrink-0') {
      return { flexShrink: '0' };
    }

    // grow, grow-0
    if (className === 'grow') {
      return { flexGrow: '1' };
    }
    if (className === 'grow-0') {
      return { flexGrow: '0' };
    }

    // flex-shrink-{value}
    const shrinkMatch = className.match(/^flex-shrink-(\d+)$/);
    if (shrinkMatch) {
      return { flexShrink: shrinkMatch[1] };
    }

    // flex-grow-{value}
    const growMatch = className.match(/^flex-grow-(\d+)$/);
    if (growMatch) {
      return { flexGrow: growMatch[1] };
    }

    return {};
  }

  /**
   * Width 변환: w-{value}
   */
  private resolveWidth(className: string): ResolvedStyles {
    const value = className.replace(/^w-/, '');
    const resolved = this.resolveSizeValue(value, 'vw');
    return resolved ? { width: resolved } : {};
  }

  /**
   * Height 변환: h-{value}
   */
  private resolveHeight(className: string): ResolvedStyles {
    const value = className.replace(/^h-/, '');
    const resolved = this.resolveSizeValue(value, 'vh');
    return resolved ? { height: resolved } : {};
  }

  /**
   * Min Width 변환: min-w-{value}
   */
  private resolveMinWidth(className: string): ResolvedStyles {
    const value = className.replace(/^min-w-/, '');
    const resolved = this.resolveSizeValue(value, 'vw');
    return resolved ? { minWidth: resolved } : {};
  }

  /**
   * Max Width 변환: max-w-{value}
   */
  private resolveMaxWidth(className: string): ResolvedStyles {
    const value = className.replace(/^max-w-/, '');
    const resolved = this.resolveSizeValue(value, 'vw');
    return resolved ? { maxWidth: resolved } : {};
  }

  /**
   * Min Height 변환: min-h-{value}
   */
  private resolveMinHeight(className: string): ResolvedStyles {
    const value = className.replace(/^min-h-/, '');
    const resolved = this.resolveSizeValue(value, 'vh');
    return resolved ? { minHeight: resolved } : {};
  }

  /**
   * Max Height 변환: max-h-{value}
   */
  private resolveMaxHeight(className: string): ResolvedStyles {
    const value = className.replace(/^max-h-/, '');
    const resolved = this.resolveSizeValue(value, 'vh');
    return resolved ? { maxHeight: resolved } : {};
  }

  /**
   * Size 값 해석 (width, height 공용)
   * @param value 클래스 값 (예: "full", "px", "4", "[40px]")
   * @param screenUnit screen에 사용할 단위 (vw 또는 vh)
   */
  private resolveSizeValue(value: string, screenUnit: 'vw' | 'vh'): string | null {
    // Arbitrary value: [40px], [50%], [80vh]
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return arbitraryMatch[1];
    }

    // Preset values
    const presets: Record<string, string> = {
      full: '100%',
      px: '1px',
      auto: 'auto',
      screen: `100${screenUnit}`,
      '1/2': '50%',
      '1/3': '33.333333%',
      '2/3': '66.666667%',
      '1/4': '25%',
      '3/4': '75%',
      min: 'min-content',
      max: 'max-content',
      fit: 'fit-content',
    };

    if (presets[value]) {
      return presets[value];
    }

    // Numeric scale: 4 → 16px (Tailwind 4px 단위)
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      return `${numValue * 4}px`;
    }

    return null;
  }

  // ============================================
  // Phase 2: 중빈도 사용 클래스 (2순위)
  // ============================================

  /**
   * Box Shadow 변환: shadow-{size}
   */
  private resolveShadow(className: string): ResolvedStyles {
    // Tailwind default box-shadow presets
    const shadowPresets: Record<string, string> = {
      shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      'shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      'shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      'shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      'shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      'shadow-2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      'shadow-inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
      'shadow-none': 'none',
    };

    if (shadowPresets[className]) {
      return { boxShadow: shadowPresets[className] };
    }

    return {};
  }

  /**
   * Cursor 변환: cursor-{type}
   */
  private resolveCursor(className: string): ResolvedStyles {
    const cursorValue = className.replace(/^cursor-/, '');
    const validCursors = [
      'auto',
      'default',
      'pointer',
      'wait',
      'text',
      'move',
      'help',
      'not-allowed',
      'none',
      'context-menu',
      'progress',
      'cell',
      'crosshair',
      'vertical-text',
      'alias',
      'copy',
      'no-drop',
      'grab',
      'grabbing',
      'all-scroll',
      'col-resize',
      'row-resize',
      'n-resize',
      'e-resize',
      's-resize',
      'w-resize',
      'ne-resize',
      'nw-resize',
      'se-resize',
      'sw-resize',
      'ew-resize',
      'ns-resize',
      'nesw-resize',
      'nwse-resize',
      'zoom-in',
      'zoom-out',
    ];

    if (validCursors.includes(cursorValue)) {
      return { cursor: cursorValue };
    }

    return {};
  }

  /**
   * Self Align 변환: self-{value}
   */
  private resolveSelf(className: string): ResolvedStyles {
    const selfMap: Record<string, string> = {
      'self-auto': 'auto',
      'self-start': 'flex-start',
      'self-end': 'flex-end',
      'self-center': 'center',
      'self-stretch': 'stretch',
      'self-baseline': 'baseline',
    };

    if (selfMap[className]) {
      return { alignSelf: selfMap[className] };
    }

    return {};
  }

  /**
   * Opacity 변환: opacity-{value}
   */
  private resolveOpacity(className: string): ResolvedStyles {
    const value = className.replace(/^opacity-/, '');

    // Arbitrary value: opacity-[0.85]
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return { opacity: arbitraryMatch[1] };
    }

    // Numeric value: opacity-0, opacity-50, opacity-100
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      // Tailwind uses 0-100 scale, convert to 0-1
      return { opacity: String(numValue / 100) };
    }

    return {};
  }

  /**
   * Transition 변환: transition-{type}
   */
  private resolveTransition(className: string): ResolvedStyles {
    const transitionPresets: Record<string, string> = {
      transition:
        'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      'transition-all': 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      'transition-colors':
        'color, background-color, border-color, text-decoration-color, fill, stroke 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      'transition-opacity': 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      'transition-shadow': 'box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      'transition-transform': 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      'transition-none': 'none',
    };

    if (transitionPresets[className]) {
      return { transition: transitionPresets[className] };
    }

    return {};
  }

  /**
   * Duration 변환: duration-{value}
   */
  private resolveDuration(className: string): ResolvedStyles {
    const value = className.replace(/^duration-/, '');

    // Arbitrary value: duration-[400ms]
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return { transitionDuration: arbitraryMatch[1] };
    }

    // Numeric value: duration-75, duration-150, duration-300, etc.
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      return { transitionDuration: `${numValue}ms` };
    }

    return {};
  }

  // ============================================
  // Phase 3: 저빈도/복잡 클래스 (3순위)
  // ============================================

  /**
   * Margin 클래스인지 확인
   */
  private isMarginClass(className: string): boolean {
    return /^m[xytblr]?-/.test(className);
  }

  /**
   * Margin 변환
   */
  private resolveMargin(className: string): ResolvedStyles {
    const match = className.match(/^(m[xytblr]?)-(.+)$/);
    if (!match) return {};

    const [, prefix, value] = match;

    // Arbitrary value: m-[20px], mx-[auto] 등
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    let formatted: string;
    if (arbitraryMatch) {
      formatted = arbitraryMatch[1];
    } else {
      const resolved = this.resolveSpacingWithToken(value);
      if (!resolved.spacing) return {};
      formatted = resolved.formatted;
    }

    switch (prefix) {
      case 'm':
        return { margin: formatted };
      case 'mx':
        return { marginLeft: formatted, marginRight: formatted };
      case 'my':
        return { marginTop: formatted, marginBottom: formatted };
      case 'mt':
        return { marginTop: formatted };
      case 'mr':
        return { marginRight: formatted };
      case 'mb':
        return { marginBottom: formatted };
      case 'ml':
        return { marginLeft: formatted };
      /* v8 ignore next 3 */
      // 도달 불가능: regex로 이미 m, mx, my, mt, mr, mb, ml만 허용
      default:
        return {};
    }
  }

  /**
   * Position 클래스인지 확인
   */
  private isPositionClass(className: string): boolean {
    return ['relative', 'absolute', 'fixed', 'sticky', 'static'].includes(className);
  }

  /**
   * Position 변환
   */
  private resolvePosition(className: string): ResolvedStyles {
    return { position: className };
  }

  /**
   * Inset 변환: inset-{value}, inset-x-{value}, inset-y-{value}
   */
  private resolveInset(className: string): ResolvedStyles {
    // inset-x-{value}
    if (className.startsWith('inset-x-')) {
      const value = className.replace(/^inset-x-/, '');
      const resolved = this.resolvePositionValue(value);
      if (resolved !== null) {
        return { left: resolved, right: resolved };
      }
    }

    // inset-y-{value}
    if (className.startsWith('inset-y-')) {
      const value = className.replace(/^inset-y-/, '');
      const resolved = this.resolvePositionValue(value);
      if (resolved !== null) {
        return { top: resolved, bottom: resolved };
      }
    }

    // inset-{value}
    const value = className.replace(/^inset-/, '');
    const resolved = this.resolvePositionValue(value);
    if (resolved !== null) {
      return { top: resolved, right: resolved, bottom: resolved, left: resolved };
    }

    return {};
  }

  /**
   * Position offset 클래스인지 확인 (top, right, bottom, left)
   */
  private isPositionOffset(className: string): boolean {
    return /^(top|right|bottom|left)-/.test(className);
  }

  /**
   * Position offset 변환: top-{value}, right-{value}, bottom-{value}, left-{value}
   */
  private resolvePositionOffset(className: string): ResolvedStyles {
    const match = className.match(/^(top|right|bottom|left)-(.+)$/);
    if (!match) return {};

    const [, property, value] = match;
    const resolved = this.resolvePositionValue(value);

    if (resolved !== null) {
      return { [property]: resolved };
    }

    return {};
  }

  /**
   * Position 값 해석 (top, right, bottom, left, inset 공용)
   */
  private resolvePositionValue(value: string): string | null {
    // Arbitrary value: [10px], [50%]
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return arbitraryMatch[1];
    }

    // Preset values
    if (value === 'auto') {
      return 'auto';
    }
    if (value === 'full') {
      return '100%';
    }
    if (value === '1/2') {
      return '50%';
    }
    if (value === '1/3') {
      return '33.333333%';
    }
    if (value === '2/3') {
      return '66.666667%';
    }
    if (value === '1/4') {
      return '25%';
    }
    if (value === '3/4') {
      return '75%';
    }

    // Numeric scale: 0 → 0px, 4 → 16px (Tailwind 4px 단위)
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      if (numValue === 0) {
        return '0px';
      }
      return `${numValue * 4}px`;
    }

    return null;
  }

  /**
   * Overflow 변환: overflow-{value}, overflow-x-{value}, overflow-y-{value}
   */
  private resolveOverflow(className: string): ResolvedStyles {
    const value = className.replace(/^overflow-/, '');

    // overflow-x-{value}
    if (value.startsWith('x-')) {
      const xValue = value.replace(/^x-/, '');
      return { overflowX: xValue };
    }

    // overflow-y-{value}
    if (value.startsWith('y-')) {
      const yValue = value.replace(/^y-/, '');
      return { overflowY: yValue };
    }

    // overflow-{value}
    const validValues = ['auto', 'hidden', 'clip', 'visible', 'scroll'];
    if (validValues.includes(value)) {
      return { overflow: value };
    }

    return {};
  }

  /**
   * Text decoration 클래스인지 확인
   */
  private isTextDecoration(className: string): boolean {
    return ['underline', 'no-underline', 'line-through', 'overline'].includes(className);
  }

  /**
   * Text decoration 변환
   */
  private resolveTextDecoration(className: string): ResolvedStyles {
    const decorationMap: Record<string, string> = {
      underline: 'underline',
      'no-underline': 'none',
      'line-through': 'line-through',
      overline: 'overline',
    };

    if (decorationMap[className]) {
      return { textDecoration: decorationMap[className] };
    }

    return {};
  }

  /**
   * Underline offset 변환: underline-offset-{value}
   */
  private resolveUnderlineOffset(className: string): ResolvedStyles {
    const value = className.replace(/^underline-offset-/, '');

    // Arbitrary value: underline-offset-[3px]
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return { textUnderlineOffset: arbitraryMatch[1] };
    }

    // Preset values
    if (value === 'auto') {
      return { textUnderlineOffset: 'auto' };
    }

    // Numeric value: underline-offset-0, underline-offset-2, underline-offset-4, underline-offset-8
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      return { textUnderlineOffset: `${numValue}px` };
    }

    return {};
  }

  /**
   * Whitespace 변환: whitespace-{value}
   */
  private resolveWhitespace(className: string): ResolvedStyles {
    const value = className.replace(/^whitespace-/, '');

    const whitespaceMap: Record<string, string> = {
      normal: 'normal',
      nowrap: 'nowrap',
      pre: 'pre',
      'pre-line': 'pre-line',
      'pre-wrap': 'pre-wrap',
      'break-spaces': 'break-spaces',
    };

    if (whitespaceMap[value]) {
      return { whiteSpace: whitespaceMap[value] };
    }

    return {};
  }

  /**
   * Z-Index 변환: z-{value}
   */
  private resolveZIndex(className: string): ResolvedStyles {
    const value = className.replace(/^z-/, '');

    // Arbitrary value: z-[100]
    const arbitraryMatch = value.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      return { zIndex: arbitraryMatch[1] };
    }

    // z-auto
    if (value === 'auto') {
      return { zIndex: 'auto' };
    }

    // Numeric value: z-0, z-10, z-20, z-30, z-40, z-50
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      return { zIndex: String(numValue) };
    }

    return {};
  }
}
