/**
 * class-resolver.ts 단위 테스트
 * TDD: RED → GREEN → REFACTOR
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ClassResolver } from '../../../src/utils/class-resolver';
import type { DesignTokens } from '../../../src/types';
import tokens from '../fixtures/tokens.json';

describe('ClassResolver', () => {
  let resolver: ClassResolver;

  beforeAll(() => {
    resolver = new ClassResolver(tokens as DesignTokens);
  });

  describe('배경색 변환', () => {
    it('bg-bg-accent → backgroundColor: color/role/bg/accent (#0033a0)', () => {
      const result = resolver.resolve(['bg-bg-accent']);
      // 토큰 이름이 있으면 "tokenName (#value)" 형식
      expect(result).toEqual({ backgroundColor: 'color/role/bg/accent (#0033a0)' });
    });

    it('bg-bg-surface → backgroundColor: #ffffff (토큰 이름 없음)', () => {
      const result = resolver.resolve(['bg-bg-surface']);
      // tokenMapping에 없으면 값만 반환
      expect(result).toEqual({ backgroundColor: '#ffffff' });
    });

    it('bg-bg-semantic-error → backgroundColor: #d32f2f (토큰 이름 없음)', () => {
      const result = resolver.resolve(['bg-bg-semantic-error']);
      expect(result).toEqual({ backgroundColor: '#d32f2f' });
    });

    it('존재하지 않는 배경색 토큰 → 빈 객체', () => {
      const result = resolver.resolve(['bg-unknown-color']);
      expect(result).toEqual({});
    });
  });

  describe('텍스트 색상 변환', () => {
    it('text-text-primary → color: color/role/text/primary (#212529)', () => {
      const result = resolver.resolve(['text-text-primary']);
      // tokenMapping에 있으므로 토큰 이름 포함
      expect(result).toEqual({ color: 'color/role/text/primary (#212529)' });
    });

    it('text-text-inverse → color: color/role/text/inverse (#ffffff)', () => {
      const result = resolver.resolve(['text-text-inverse']);
      // tokenMapping에 있으므로 토큰 이름 포함
      expect(result).toEqual({ color: 'color/role/text/inverse (#ffffff)' });
    });

    it('text-text-accent → color: #0033a0 (토큰 이름 없음)', () => {
      const result = resolver.resolve(['text-text-accent']);
      // tokenMapping에 없으므로 값만 반환
      expect(result).toEqual({ color: '#0033a0' });
    });

    it('존재하지 않는 텍스트 색상/타이포그래피 → 빈 객체', () => {
      const result = resolver.resolve(['text-unknown-token']);
      expect(result).toEqual({});
    });
  });

  describe('패딩 변환', () => {
    it('py-component-inset-button-y → paddingTop/Bottom: space/component/inset/button/y (8px)', () => {
      const result = resolver.resolve(['py-component-inset-button-y']);
      // tokenMapping에 있으므로 토큰 이름 포함
      expect(result).toEqual({
        paddingTop: 'space/component/inset/button/y (8px)',
        paddingBottom: 'space/component/inset/button/y (8px)',
      });
    });

    it('px-component-inset-button-lg-x → paddingLeft/Right: 16px (토큰 이름 없음)', () => {
      const result = resolver.resolve(['px-component-inset-button-lg-x']);
      // tokenMapping에 없으므로 값만 반환
      expect(result).toEqual({
        paddingLeft: '16px',
        paddingRight: '16px',
      });
    });

    it('px-4 → paddingLeft/Right: space/scale/4 (4px)', () => {
      const result = resolver.resolve(['px-4']);
      // tokenMapping에 "4" → "space/scale/4" 있음
      expect(result).toEqual({
        paddingLeft: 'space/scale/4 (4px)',
        paddingRight: 'space/scale/4 (4px)',
      });
    });

    it('p-2 → padding: space/scale/2 (2px)', () => {
      const result = resolver.resolve(['p-2']);
      // tokenMapping에 "2" → "space/scale/2" 있음
      expect(result).toEqual({
        padding: 'space/scale/2 (2px)',
      });
    });

    it('pt-4 → paddingTop: space/scale/4 (4px)', () => {
      const result = resolver.resolve(['pt-4']);
      // tokenMapping에 "4" → "space/scale/4" 있음
      expect(result).toEqual({ paddingTop: 'space/scale/4 (4px)' });
    });

    it('pr-8 → paddingRight: space/scale/8 (8px)', () => {
      const result = resolver.resolve(['pr-8']);
      // tokenMapping에 "8" → "space/scale/8" 있음
      expect(result).toEqual({ paddingRight: 'space/scale/8 (8px)' });
    });

    it('pb-6 → paddingBottom: 6px (토큰 이름 없음)', () => {
      const result = resolver.resolve(['pb-6']);
      // tokenMapping에 "6" 없음, spacing에 "6" 있음
      expect(result).toEqual({ paddingBottom: '6px' });
    });

    it('pl-10 → paddingLeft: 10px (토큰 이름 없음)', () => {
      const result = resolver.resolve(['pl-10']);
      // tokenMapping에 "10" 없음, spacing에 "10" 있음
      expect(result).toEqual({ paddingLeft: '10px' });
    });

    it('숫자 기반 패딩: px-3 → paddingLeft/Right: 12px (Tailwind 4px 단위)', () => {
      const result = resolver.resolve(['px-3']);
      // spacing에 "3" 없음 → Tailwind 변환 (3*4=12px), tokenMapping에도 없음
      expect(result).toEqual({
        paddingLeft: '12px',
        paddingRight: '12px',
      });
    });

    it('존재하지 않는 패딩 값 → 빈 객체', () => {
      const result = resolver.resolve(['px-invalid']);
      expect(result).toEqual({});
    });

    it('패딩 접두사만 있고 값이 없는 경우 → 빈 객체', () => {
      // isPaddingClass는 true이지만 match는 null
      const result = resolver.resolve(['px-']);
      expect(result).toEqual({});
    });
  });

  describe('gap 변환', () => {
    it('gap-component-gap-icon-label-x-md → gap: 8px (토큰 이름 없음)', () => {
      const result = resolver.resolve(['gap-component-gap-icon-label-x-md']);
      // tokenMapping에 없으므로 값만 반환
      expect(result).toEqual({ gap: '8px' });
    });

    it('gap-2 → gap: space/scale/2 (2px)', () => {
      const result = resolver.resolve(['gap-2']);
      // tokenMapping에 "2" → "space/scale/2" 있음
      expect(result).toEqual({ gap: 'space/scale/2 (2px)' });
    });

    it('숫자 기반 gap: gap-5 → gap: 20px (Tailwind 4px 단위)', () => {
      const result = resolver.resolve(['gap-5']);
      // spacing에 "5" 없음 → Tailwind 변환 (5*4=20px), tokenMapping에도 없음
      expect(result).toEqual({ gap: '20px' });
    });

    it('존재하지 않는 gap 토큰 → 빈 객체', () => {
      const result = resolver.resolve(['gap-invalid']);
      expect(result).toEqual({});
    });
  });

  describe('border-radius 변환', () => {
    it('rounded-lg → borderRadius: 8px', () => {
      const result = resolver.resolve(['rounded-lg']);
      expect(result).toEqual({ borderRadius: '8px' });
    });

    it('rounded-md → borderRadius: 6px', () => {
      const result = resolver.resolve(['rounded-md']);
      expect(result).toEqual({ borderRadius: '6px' });
    });

    it('rounded-full → borderRadius: 9999px', () => {
      const result = resolver.resolve(['rounded-full']);
      expect(result).toEqual({ borderRadius: '9999px' });
    });

    it('rounded- (접두사만) → borderRadius: 4px (DEFAULT)', () => {
      const result = resolver.resolve(['rounded-']);
      expect(result).toEqual({ borderRadius: '4px' });
    });

    it('존재하지 않는 border-radius → 빈 객체', () => {
      const result = resolver.resolve(['rounded-unknown']);
      expect(result).toEqual({});
    });
  });

  describe('타이포그래피 변환', () => {
    it('text-button-md-medium → fontSize: button/md/medium (16px), lineHeight, fontWeight', () => {
      const result = resolver.resolve(['text-button-md-medium']);
      // tokenMapping에 typography-button-md-medium → button/md/medium 있음
      expect(result).toEqual({
        fontSize: 'button/md/medium (16px)',
        lineHeight: '20px',
        fontWeight: '500',
      });
    });

    it('text-body-md-regular → fontSize, lineHeight, fontWeight (토큰 이름 없음)', () => {
      const result = resolver.resolve(['text-body-md-regular']);
      // tokenMapping에 typography-body-md-regular 없음
      expect(result).toEqual({
        fontSize: '16px',
        lineHeight: '24px',
        fontWeight: '400',
      });
    });
  });

  describe('테두리 변환', () => {
    it('border-border-default → borderColor: color/role/border/default (#dee2e6)', () => {
      const result = resolver.resolve(['border-border-default']);
      // tokenMapping에 있으므로 토큰 이름 포함
      expect(result).toEqual({ borderColor: 'color/role/border/default (#dee2e6)' });
    });

    it('outline-border-accent → outlineColor: #0033a0 (토큰 이름 없음)', () => {
      const result = resolver.resolve(['outline-border-accent']);
      // tokenMapping에 없으므로 값만 반환
      expect(result).toEqual({ outlineColor: '#0033a0' });
    });

    it('존재하지 않는 border 색상 → 빈 객체', () => {
      const result = resolver.resolve(['border-unknown-color']);
      expect(result).toEqual({});
    });

    it('존재하지 않는 outline 색상 → 빈 객체', () => {
      const result = resolver.resolve(['outline-unknown-color']);
      expect(result).toEqual({});
    });
  });

  describe('복합 클래스 병합', () => {
    it('Button primary md 스타일 조합 (토큰 이름 포함)', () => {
      const result = resolver.resolve([
        'bg-bg-accent',
        'text-text-inverse',
        'py-component-inset-button-y',
        'px-component-inset-button-md-x',
        'rounded-lg',
        'text-button-md-medium',
      ]);

      // tokenMapping에 있는 토큰들은 "tokenName (value)" 형식으로 반환
      expect(result).toEqual({
        backgroundColor: 'color/role/bg/accent (#0033a0)',
        color: 'color/role/text/inverse (#ffffff)',
        paddingTop: 'space/component/inset/button/y (8px)',
        paddingBottom: 'space/component/inset/button/y (8px)',
        paddingLeft: 'space/component/inset/button/md/x (14px)',
        paddingRight: 'space/component/inset/button/md/x (14px)',
        borderRadius: '8px',
        fontSize: 'button/md/medium (16px)',
        lineHeight: '20px',
        fontWeight: '500',
      });
    });

    it('빈 배열 → 빈 객체', () => {
      const result = resolver.resolve([]);
      expect(result).toEqual({});
    });

    it('알 수 없는 클래스 → 무시', () => {
      const result = resolver.resolve(['unknown-class', 'bg-bg-accent']);
      // tokenMapping에 있으므로 토큰 이름 포함
      expect(result).toEqual({ backgroundColor: 'color/role/bg/accent (#0033a0)' });
    });
  });

  describe('Flexbox 유틸리티', () => {
    it('flex → display: flex', () => {
      const result = resolver.resolve(['flex']);
      expect(result).toEqual({ display: 'flex' });
    });

    it('inline-flex → display: inline-flex', () => {
      const result = resolver.resolve(['inline-flex']);
      expect(result).toEqual({ display: 'inline-flex' });
    });

    it('justify-center → justifyContent: center', () => {
      const result = resolver.resolve(['justify-center']);
      expect(result).toEqual({ justifyContent: 'center' });
    });

    it('items-center → alignItems: center', () => {
      const result = resolver.resolve(['items-center']);
      expect(result).toEqual({ alignItems: 'center' });
    });

    it('justify-start → justifyContent: flex-start', () => {
      const result = resolver.resolve(['justify-start']);
      expect(result).toEqual({ justifyContent: 'flex-start' });
    });

    it('justify-end → justifyContent: flex-end', () => {
      const result = resolver.resolve(['justify-end']);
      expect(result).toEqual({ justifyContent: 'flex-end' });
    });

    it('justify-between → justifyContent: space-between', () => {
      const result = resolver.resolve(['justify-between']);
      expect(result).toEqual({ justifyContent: 'space-between' });
    });

    it('items-start → alignItems: flex-start', () => {
      const result = resolver.resolve(['items-start']);
      expect(result).toEqual({ alignItems: 'flex-start' });
    });

    it('items-end → alignItems: flex-end', () => {
      const result = resolver.resolve(['items-end']);
      expect(result).toEqual({ alignItems: 'flex-end' });
    });
  });

  describe('상태 수정자(pseudo-class) 파싱', () => {
    describe('resolveWithStates - 상태별 스타일 분리', () => {
      it('focus-visible:ring-2 → focus-visible 상태로 분리', () => {
        const result = resolver.resolveWithStates([
          'bg-bg-accent',
          'focus-visible:ring-2',
          'focus-visible:ring-focus',
        ]);

        expect(result.default).toEqual({
          backgroundColor: 'color/role/bg/accent (#0033a0)',
        });
        expect(result['focus-visible']).toBeDefined();
        expect(result['focus-visible']?.boxShadow).toContain('0 0 0 2px');
      });

      it('hover: 상태 분리', () => {
        const result = resolver.resolveWithStates([
          'bg-bg-accent',
          'hover:bg-brand-primary-hover',
        ]);

        expect(result.default?.backgroundColor).toBe('color/role/bg/accent (#0033a0)');
        expect(result.hover?.backgroundColor).toBeDefined();
      });

      it('active: 상태 분리', () => {
        const result = resolver.resolveWithStates([
          'bg-bg-accent',
          'active:bg-brand-primary-pressed',
        ]);

        expect(result.default?.backgroundColor).toBe('color/role/bg/accent (#0033a0)');
        expect(result.active?.backgroundColor).toBeDefined();
      });

      it('상태 수정자 없는 경우 → default만 반환', () => {
        const result = resolver.resolveWithStates([
          'bg-bg-accent',
          'text-text-primary',
        ]);

        expect(Object.keys(result)).toEqual(['default']);
        expect(result.default).toEqual({
          backgroundColor: 'color/role/bg/accent (#0033a0)',
          color: 'color/role/text/primary (#212529)',
        });
      });
    });
  });

  describe('ring 클래스 변환 (box-shadow)', () => {
    it('ring-2 ring-focus → boxShadow: 0 0 0 2px #0033a0', () => {
      const result = resolver.resolve(['ring-2', 'ring-focus']);
      expect(result.boxShadow).toBe('0 0 0 2px #0033a0');
    });

    it('ring-1 ring-inset ring-border-contrast → boxShadow: inset 0 0 0 1px #ffffff', () => {
      const result = resolver.resolve(['ring-1', 'ring-inset', 'ring-border-contrast']);
      expect(result.boxShadow).toBe('inset 0 0 0 1px #ffffff');
    });

    it('복합 ring 스타일 (destructive button focus)', () => {
      // destructive button의 focus 상태: ring-1 ring-inset ring-border-contrast + ring-2 ring-focus
      const result = resolver.resolve([
        'ring-1',
        'ring-inset',
        'ring-border-contrast',
        'ring-2',
        'ring-focus',
      ]);
      // inset ring (1px 흰색) + outer ring (2px 파란색)
      expect(result.boxShadow).toContain('inset 0 0 0 1px #ffffff');
      expect(result.boxShadow).toContain('0 0 0 2px #0033a0');
    });

    it('ring-0 → boxShadow: none', () => {
      const result = resolver.resolve(['ring-0']);
      expect(result.boxShadow).toBe('none');
    });

    it('ring 클래스 없이 다른 클래스만 → boxShadow 없음', () => {
      const result = resolver.resolve(['bg-bg-accent']);
      expect(result.boxShadow).toBeUndefined();
    });
  });

  describe('getStateStyles - 특정 상태 스타일 조회', () => {
    it('focus-visible 상태 스타일만 조회', () => {
      const result = resolver.getStateStyles(
        [
          'bg-bg-accent',
          'focus-visible:outline-none',
          'focus-visible:ring-1',
          'focus-visible:ring-inset',
          'focus-visible:ring-border-contrast',
          'focus-visible:ring-2',
          'focus-visible:ring-focus',
        ],
        'focus-visible'
      );

      expect(result.outline).toBe('none');
      expect(result.boxShadow).toBeDefined();
    });

    it('hover 상태 스타일만 조회', () => {
      const result = resolver.getStateStyles(
        [
          'bg-bg-accent',
          'hover:bg-brand-primary-hover',
        ],
        'hover'
      );

      expect(result.backgroundColor).toBeDefined();
    });

    it('존재하지 않는 상태 조회 → 빈 객체', () => {
      const result = resolver.getStateStyles(
        ['bg-bg-accent', 'hover:bg-brand-primary-hover'],
        'active'
      );

      expect(result).toEqual({});
    });
  });

  // ============================================
  // Phase 1: 고빈도 사용 클래스 (1순위)
  // ============================================

  describe('Width/Height 변환', () => {
    it('w-[40px] → width: 40px (arbitrary value)', () => {
      const result = resolver.resolve(['w-[40px]']);
      expect(result).toEqual({ width: '40px' });
    });

    it('w-full → width: 100%', () => {
      const result = resolver.resolve(['w-full']);
      expect(result).toEqual({ width: '100%' });
    });

    it('w-px → width: 1px', () => {
      const result = resolver.resolve(['w-px']);
      expect(result).toEqual({ width: '1px' });
    });

    it('w-4 → width: 16px (숫자 스케일)', () => {
      const result = resolver.resolve(['w-4']);
      expect(result).toEqual({ width: '16px' });
    });

    it('w-auto → width: auto', () => {
      const result = resolver.resolve(['w-auto']);
      expect(result).toEqual({ width: 'auto' });
    });

    it('w-screen → width: 100vw', () => {
      const result = resolver.resolve(['w-screen']);
      expect(result).toEqual({ width: '100vw' });
    });

    it('h-[36px] → height: 36px (arbitrary value)', () => {
      const result = resolver.resolve(['h-[36px]']);
      expect(result).toEqual({ height: '36px' });
    });

    it('h-full → height: 100%', () => {
      const result = resolver.resolve(['h-full']);
      expect(result).toEqual({ height: '100%' });
    });

    it('h-screen → height: 100vh', () => {
      const result = resolver.resolve(['h-screen']);
      expect(result).toEqual({ height: '100vh' });
    });

    it('h-8 → height: 32px (숫자 스케일)', () => {
      const result = resolver.resolve(['h-8']);
      expect(result).toEqual({ height: '32px' });
    });
  });

  describe('Min/Max Width/Height 변환', () => {
    it('min-w-[56px] → minWidth: 56px', () => {
      const result = resolver.resolve(['min-w-[56px]']);
      expect(result).toEqual({ minWidth: '56px' });
    });

    it('min-w-full → minWidth: 100%', () => {
      const result = resolver.resolve(['min-w-full']);
      expect(result).toEqual({ minWidth: '100%' });
    });

    it('max-w-[320px] → maxWidth: 320px', () => {
      const result = resolver.resolve(['max-w-[320px]']);
      expect(result).toEqual({ maxWidth: '320px' });
    });

    it('max-w-full → maxWidth: 100%', () => {
      const result = resolver.resolve(['max-w-full']);
      expect(result).toEqual({ maxWidth: '100%' });
    });

    it('min-h-[100px] → minHeight: 100px', () => {
      const result = resolver.resolve(['min-h-[100px]']);
      expect(result).toEqual({ minHeight: '100px' });
    });

    it('min-h-full → minHeight: 100%', () => {
      const result = resolver.resolve(['min-h-full']);
      expect(result).toEqual({ minHeight: '100%' });
    });

    it('max-h-[80vh] → maxHeight: 80vh', () => {
      const result = resolver.resolve(['max-h-[80vh]']);
      expect(result).toEqual({ maxHeight: '80vh' });
    });

    it('max-h-screen → maxHeight: 100vh', () => {
      const result = resolver.resolve(['max-h-screen']);
      expect(result).toEqual({ maxHeight: '100vh' });
    });
  });

  describe('Flex Direction 변환', () => {
    it('flex-col → flexDirection: column', () => {
      const result = resolver.resolve(['flex-col']);
      expect(result).toEqual({ flexDirection: 'column' });
    });

    it('flex-row → flexDirection: row', () => {
      const result = resolver.resolve(['flex-row']);
      expect(result).toEqual({ flexDirection: 'row' });
    });

    it('flex-col-reverse → flexDirection: column-reverse', () => {
      const result = resolver.resolve(['flex-col-reverse']);
      expect(result).toEqual({ flexDirection: 'column-reverse' });
    });

    it('flex-row-reverse → flexDirection: row-reverse', () => {
      const result = resolver.resolve(['flex-row-reverse']);
      expect(result).toEqual({ flexDirection: 'row-reverse' });
    });
  });

  describe('Flex Shrink/Grow 변환', () => {
    it('flex-shrink-0 → flexShrink: 0', () => {
      const result = resolver.resolve(['flex-shrink-0']);
      expect(result).toEqual({ flexShrink: '0' });
    });

    it('shrink-0 → flexShrink: 0', () => {
      const result = resolver.resolve(['shrink-0']);
      expect(result).toEqual({ flexShrink: '0' });
    });

    it('shrink → flexShrink: 1', () => {
      const result = resolver.resolve(['shrink']);
      expect(result).toEqual({ flexShrink: '1' });
    });

    it('grow → flexGrow: 1', () => {
      const result = resolver.resolve(['grow']);
      expect(result).toEqual({ flexGrow: '1' });
    });

    it('grow-0 → flexGrow: 0', () => {
      const result = resolver.resolve(['grow-0']);
      expect(result).toEqual({ flexGrow: '0' });
    });

    it('flex-1 → flex: 1 1 0%', () => {
      const result = resolver.resolve(['flex-1']);
      expect(result).toEqual({ flex: '1 1 0%' });
    });

    it('flex-auto → flex: 1 1 auto', () => {
      const result = resolver.resolve(['flex-auto']);
      expect(result).toEqual({ flex: '1 1 auto' });
    });

    it('flex-none → flex: none', () => {
      const result = resolver.resolve(['flex-none']);
      expect(result).toEqual({ flex: 'none' });
    });

    it('flex-initial → flex: 0 1 auto', () => {
      const result = resolver.resolve(['flex-initial']);
      expect(result).toEqual({ flex: '0 1 auto' });
    });
  });

  describe('Border Width 변환', () => {
    it('border → borderWidth: 1px', () => {
      const result = resolver.resolve(['border']);
      expect(result).toEqual({ borderWidth: '1px' });
    });

    it('border-0 → borderWidth: 0px', () => {
      const result = resolver.resolve(['border-0']);
      expect(result).toEqual({ borderWidth: '0px' });
    });

    it('border-2 → borderWidth: 2px', () => {
      const result = resolver.resolve(['border-2']);
      expect(result).toEqual({ borderWidth: '2px' });
    });

    it('border-4 → borderWidth: 4px', () => {
      const result = resolver.resolve(['border-4']);
      expect(result).toEqual({ borderWidth: '4px' });
    });

    it('border-8 → borderWidth: 8px', () => {
      const result = resolver.resolve(['border-8']);
      expect(result).toEqual({ borderWidth: '8px' });
    });

    it('border-[3px] → borderWidth: 3px (arbitrary)', () => {
      const result = resolver.resolve(['border-[3px]']);
      expect(result).toEqual({ borderWidth: '3px' });
    });

    it('border와 border-color 함께 사용', () => {
      const result = resolver.resolve(['border', 'border-border-default']);
      expect(result).toEqual({
        borderWidth: '1px',
        borderColor: 'color/role/border/default (#dee2e6)',
      });
    });
  });

  describe('Outline Width/Offset 변환', () => {
    it('outline → outlineStyle: solid', () => {
      const result = resolver.resolve(['outline']);
      expect(result).toEqual({ outlineStyle: 'solid' });
    });

    it('outline-1 → outlineWidth: 1px', () => {
      const result = resolver.resolve(['outline-1']);
      expect(result).toEqual({ outlineWidth: '1px' });
    });

    it('outline-2 → outlineWidth: 2px', () => {
      const result = resolver.resolve(['outline-2']);
      expect(result).toEqual({ outlineWidth: '2px' });
    });

    it('outline-4 → outlineWidth: 4px', () => {
      const result = resolver.resolve(['outline-4']);
      expect(result).toEqual({ outlineWidth: '4px' });
    });

    it('outline-[3px] → outlineWidth: 3px (arbitrary)', () => {
      const result = resolver.resolve(['outline-[3px]']);
      expect(result).toEqual({ outlineWidth: '3px' });
    });

    it('outline-offset-0 → outlineOffset: 0px', () => {
      const result = resolver.resolve(['outline-offset-0']);
      expect(result).toEqual({ outlineOffset: '0px' });
    });

    it('outline-offset-2 → outlineOffset: 2px', () => {
      const result = resolver.resolve(['outline-offset-2']);
      expect(result).toEqual({ outlineOffset: '2px' });
    });

    it('outline-offset-4 → outlineOffset: 4px', () => {
      const result = resolver.resolve(['outline-offset-4']);
      expect(result).toEqual({ outlineOffset: '4px' });
    });

    it('outline-offset-[-2px] → outlineOffset: -2px (arbitrary)', () => {
      const result = resolver.resolve(['outline-offset-[-2px]']);
      expect(result).toEqual({ outlineOffset: '-2px' });
    });

    it('outline-offset-[4px] → outlineOffset: 4px (arbitrary)', () => {
      const result = resolver.resolve(['outline-offset-[4px]']);
      expect(result).toEqual({ outlineOffset: '4px' });
    });
  });

  // ============================================
  // Phase 2: 중빈도 사용 클래스 (2순위)
  // ============================================

  describe('Box Shadow 변환', () => {
    it('shadow-sm → boxShadow: preset value', () => {
      const result = resolver.resolve(['shadow-sm']);
      expect(result.boxShadow).toBeDefined();
      expect(result.boxShadow).not.toBe('none');
    });

    it('shadow-md → boxShadow: preset value', () => {
      const result = resolver.resolve(['shadow-md']);
      expect(result.boxShadow).toBeDefined();
      expect(result.boxShadow).not.toBe('none');
    });

    it('shadow-lg → boxShadow: preset value', () => {
      const result = resolver.resolve(['shadow-lg']);
      expect(result.boxShadow).toBeDefined();
      expect(result.boxShadow).not.toBe('none');
    });

    it('shadow-xl → boxShadow: preset value', () => {
      const result = resolver.resolve(['shadow-xl']);
      expect(result.boxShadow).toBeDefined();
      expect(result.boxShadow).not.toBe('none');
    });

    it('shadow-none → boxShadow: none', () => {
      const result = resolver.resolve(['shadow-none']);
      expect(result).toEqual({ boxShadow: 'none' });
    });

    it('shadow → boxShadow: default preset', () => {
      const result = resolver.resolve(['shadow']);
      expect(result.boxShadow).toBeDefined();
    });
  });

  describe('Cursor 변환', () => {
    it('cursor-pointer → cursor: pointer', () => {
      const result = resolver.resolve(['cursor-pointer']);
      expect(result).toEqual({ cursor: 'pointer' });
    });

    it('cursor-not-allowed → cursor: not-allowed', () => {
      const result = resolver.resolve(['cursor-not-allowed']);
      expect(result).toEqual({ cursor: 'not-allowed' });
    });

    it('cursor-wait → cursor: wait', () => {
      const result = resolver.resolve(['cursor-wait']);
      expect(result).toEqual({ cursor: 'wait' });
    });

    it('cursor-default → cursor: default', () => {
      const result = resolver.resolve(['cursor-default']);
      expect(result).toEqual({ cursor: 'default' });
    });

    it('cursor-move → cursor: move', () => {
      const result = resolver.resolve(['cursor-move']);
      expect(result).toEqual({ cursor: 'move' });
    });

    it('cursor-text → cursor: text', () => {
      const result = resolver.resolve(['cursor-text']);
      expect(result).toEqual({ cursor: 'text' });
    });
  });

  describe('Flex Wrap 변환', () => {
    it('flex-wrap → flexWrap: wrap', () => {
      const result = resolver.resolve(['flex-wrap']);
      expect(result).toEqual({ flexWrap: 'wrap' });
    });

    it('flex-nowrap → flexWrap: nowrap', () => {
      const result = resolver.resolve(['flex-nowrap']);
      expect(result).toEqual({ flexWrap: 'nowrap' });
    });

    it('flex-wrap-reverse → flexWrap: wrap-reverse', () => {
      const result = resolver.resolve(['flex-wrap-reverse']);
      expect(result).toEqual({ flexWrap: 'wrap-reverse' });
    });
  });

  describe('Self Align 변환', () => {
    it('self-stretch → alignSelf: stretch', () => {
      const result = resolver.resolve(['self-stretch']);
      expect(result).toEqual({ alignSelf: 'stretch' });
    });

    it('self-center → alignSelf: center', () => {
      const result = resolver.resolve(['self-center']);
      expect(result).toEqual({ alignSelf: 'center' });
    });

    it('self-start → alignSelf: flex-start', () => {
      const result = resolver.resolve(['self-start']);
      expect(result).toEqual({ alignSelf: 'flex-start' });
    });

    it('self-end → alignSelf: flex-end', () => {
      const result = resolver.resolve(['self-end']);
      expect(result).toEqual({ alignSelf: 'flex-end' });
    });

    it('self-auto → alignSelf: auto', () => {
      const result = resolver.resolve(['self-auto']);
      expect(result).toEqual({ alignSelf: 'auto' });
    });

    it('self-baseline → alignSelf: baseline', () => {
      const result = resolver.resolve(['self-baseline']);
      expect(result).toEqual({ alignSelf: 'baseline' });
    });
  });

  describe('Opacity 변환', () => {
    it('opacity-0 → opacity: 0', () => {
      const result = resolver.resolve(['opacity-0']);
      expect(result).toEqual({ opacity: '0' });
    });

    it('opacity-50 → opacity: 0.5', () => {
      const result = resolver.resolve(['opacity-50']);
      expect(result).toEqual({ opacity: '0.5' });
    });

    it('opacity-100 → opacity: 1', () => {
      const result = resolver.resolve(['opacity-100']);
      expect(result).toEqual({ opacity: '1' });
    });

    it('opacity-75 → opacity: 0.75', () => {
      const result = resolver.resolve(['opacity-75']);
      expect(result).toEqual({ opacity: '0.75' });
    });

    it('opacity-[0.85] → opacity: 0.85 (arbitrary)', () => {
      const result = resolver.resolve(['opacity-[0.85]']);
      expect(result).toEqual({ opacity: '0.85' });
    });

    it('opacity-[.33] → opacity: .33 (arbitrary)', () => {
      const result = resolver.resolve(['opacity-[.33]']);
      expect(result).toEqual({ opacity: '.33' });
    });
  });

  describe('Transition 변환', () => {
    it('transition → transition: default preset', () => {
      const result = resolver.resolve(['transition']);
      expect(result.transition).toBeDefined();
    });

    it('transition-colors → transition: color properties', () => {
      const result = resolver.resolve(['transition-colors']);
      expect(result.transition).toBeDefined();
      expect(result.transition).toContain('color');
    });

    it('transition-all → transition: all', () => {
      const result = resolver.resolve(['transition-all']);
      expect(result.transition).toContain('all');
    });

    it('transition-opacity → transition: opacity', () => {
      const result = resolver.resolve(['transition-opacity']);
      expect(result.transition).toContain('opacity');
    });

    it('transition-transform → transition: transform', () => {
      const result = resolver.resolve(['transition-transform']);
      expect(result.transition).toContain('transform');
    });

    it('transition-none → transition: none', () => {
      const result = resolver.resolve(['transition-none']);
      expect(result).toEqual({ transition: 'none' });
    });

    it('duration-300 → transitionDuration: 300ms', () => {
      const result = resolver.resolve(['duration-300']);
      expect(result).toEqual({ transitionDuration: '300ms' });
    });

    it('duration-150 → transitionDuration: 150ms', () => {
      const result = resolver.resolve(['duration-150']);
      expect(result).toEqual({ transitionDuration: '150ms' });
    });

    it('duration-500 → transitionDuration: 500ms', () => {
      const result = resolver.resolve(['duration-500']);
      expect(result).toEqual({ transitionDuration: '500ms' });
    });

    it('duration-75 → transitionDuration: 75ms', () => {
      const result = resolver.resolve(['duration-75']);
      expect(result).toEqual({ transitionDuration: '75ms' });
    });

    it('duration-[400ms] → transitionDuration: 400ms (arbitrary)', () => {
      const result = resolver.resolve(['duration-[400ms]']);
      expect(result).toEqual({ transitionDuration: '400ms' });
    });
  });

  // ============================================
  // Phase 3: 저빈도/복잡 클래스 (3순위)
  // ============================================

  describe('Arbitrary Values 추가 지원', () => {
    it('rounded-[6px] → borderRadius: 6px', () => {
      const result = resolver.resolve(['rounded-[6px]']);
      expect(result).toEqual({ borderRadius: '6px' });
    });

    it('gap-[10px] → gap: 10px', () => {
      const result = resolver.resolve(['gap-[10px]']);
      expect(result).toEqual({ gap: '10px' });
    });

    it('p-[10px] → padding: 10px', () => {
      const result = resolver.resolve(['p-[10px]']);
      expect(result).toEqual({ padding: '10px' });
    });

    it('m-[20px] → margin: 20px', () => {
      const result = resolver.resolve(['m-[20px]']);
      expect(result).toEqual({ margin: '20px' });
    });

    it('mx-[auto] → marginLeft/Right: auto', () => {
      const result = resolver.resolve(['mx-[auto]']);
      expect(result).toEqual({ marginLeft: 'auto', marginRight: 'auto' });
    });
  });

  describe('Position 변환', () => {
    it('relative → position: relative', () => {
      const result = resolver.resolve(['relative']);
      expect(result).toEqual({ position: 'relative' });
    });

    it('absolute → position: absolute', () => {
      const result = resolver.resolve(['absolute']);
      expect(result).toEqual({ position: 'absolute' });
    });

    it('fixed → position: fixed', () => {
      const result = resolver.resolve(['fixed']);
      expect(result).toEqual({ position: 'fixed' });
    });

    it('sticky → position: sticky', () => {
      const result = resolver.resolve(['sticky']);
      expect(result).toEqual({ position: 'sticky' });
    });

    it('static → position: static', () => {
      const result = resolver.resolve(['static']);
      expect(result).toEqual({ position: 'static' });
    });

    it('inset-0 → top/right/bottom/left: 0px', () => {
      const result = resolver.resolve(['inset-0']);
      expect(result).toEqual({
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
      });
    });

    it('inset-x-0 → left/right: 0px', () => {
      const result = resolver.resolve(['inset-x-0']);
      expect(result).toEqual({ left: '0px', right: '0px' });
    });

    it('inset-y-0 → top/bottom: 0px', () => {
      const result = resolver.resolve(['inset-y-0']);
      expect(result).toEqual({ top: '0px', bottom: '0px' });
    });

    it('top-0 → top: 0px', () => {
      const result = resolver.resolve(['top-0']);
      expect(result).toEqual({ top: '0px' });
    });

    it('right-4 → right: 16px', () => {
      const result = resolver.resolve(['right-4']);
      expect(result).toEqual({ right: '16px' });
    });

    it('bottom-[10px] → bottom: 10px', () => {
      const result = resolver.resolve(['bottom-[10px]']);
      expect(result).toEqual({ bottom: '10px' });
    });

    it('left-auto → left: auto', () => {
      const result = resolver.resolve(['left-auto']);
      expect(result).toEqual({ left: 'auto' });
    });
  });

  describe('Overflow 변환', () => {
    it('overflow-auto → overflow: auto', () => {
      const result = resolver.resolve(['overflow-auto']);
      expect(result).toEqual({ overflow: 'auto' });
    });

    it('overflow-hidden → overflow: hidden', () => {
      const result = resolver.resolve(['overflow-hidden']);
      expect(result).toEqual({ overflow: 'hidden' });
    });

    it('overflow-visible → overflow: visible', () => {
      const result = resolver.resolve(['overflow-visible']);
      expect(result).toEqual({ overflow: 'visible' });
    });

    it('overflow-scroll → overflow: scroll', () => {
      const result = resolver.resolve(['overflow-scroll']);
      expect(result).toEqual({ overflow: 'scroll' });
    });

    it('overflow-x-auto → overflowX: auto', () => {
      const result = resolver.resolve(['overflow-x-auto']);
      expect(result).toEqual({ overflowX: 'auto' });
    });

    it('overflow-y-scroll → overflowY: scroll', () => {
      const result = resolver.resolve(['overflow-y-scroll']);
      expect(result).toEqual({ overflowY: 'scroll' });
    });

    it('overflow-x-hidden → overflowX: hidden', () => {
      const result = resolver.resolve(['overflow-x-hidden']);
      expect(result).toEqual({ overflowX: 'hidden' });
    });
  });

  describe('Text Decoration 변환', () => {
    it('underline → textDecoration: underline', () => {
      const result = resolver.resolve(['underline']);
      expect(result).toEqual({ textDecoration: 'underline' });
    });

    it('no-underline → textDecoration: none', () => {
      const result = resolver.resolve(['no-underline']);
      expect(result).toEqual({ textDecoration: 'none' });
    });

    it('line-through → textDecoration: line-through', () => {
      const result = resolver.resolve(['line-through']);
      expect(result).toEqual({ textDecoration: 'line-through' });
    });

    it('overline → textDecoration: overline', () => {
      const result = resolver.resolve(['overline']);
      expect(result).toEqual({ textDecoration: 'overline' });
    });

    it('underline-offset-auto → textUnderlineOffset: auto', () => {
      const result = resolver.resolve(['underline-offset-auto']);
      expect(result).toEqual({ textUnderlineOffset: 'auto' });
    });

    it('underline-offset-2 → textUnderlineOffset: 2px', () => {
      const result = resolver.resolve(['underline-offset-2']);
      expect(result).toEqual({ textUnderlineOffset: '2px' });
    });

    it('underline-offset-[3px] → textUnderlineOffset: 3px', () => {
      const result = resolver.resolve(['underline-offset-[3px]']);
      expect(result).toEqual({ textUnderlineOffset: '3px' });
    });
  });

  describe('Whitespace 변환', () => {
    it('whitespace-nowrap → whiteSpace: nowrap', () => {
      const result = resolver.resolve(['whitespace-nowrap']);
      expect(result).toEqual({ whiteSpace: 'nowrap' });
    });

    it('whitespace-normal → whiteSpace: normal', () => {
      const result = resolver.resolve(['whitespace-normal']);
      expect(result).toEqual({ whiteSpace: 'normal' });
    });

    it('whitespace-pre → whiteSpace: pre', () => {
      const result = resolver.resolve(['whitespace-pre']);
      expect(result).toEqual({ whiteSpace: 'pre' });
    });

    it('whitespace-pre-wrap → whiteSpace: pre-wrap', () => {
      const result = resolver.resolve(['whitespace-pre-wrap']);
      expect(result).toEqual({ whiteSpace: 'pre-wrap' });
    });

    it('whitespace-pre-line → whiteSpace: pre-line', () => {
      const result = resolver.resolve(['whitespace-pre-line']);
      expect(result).toEqual({ whiteSpace: 'pre-line' });
    });

    it('whitespace-break-spaces → whiteSpace: break-spaces', () => {
      const result = resolver.resolve(['whitespace-break-spaces']);
      expect(result).toEqual({ whiteSpace: 'break-spaces' });
    });
  });

  describe('Z-Index 변환', () => {
    it('z-0 → zIndex: 0', () => {
      const result = resolver.resolve(['z-0']);
      expect(result).toEqual({ zIndex: '0' });
    });

    it('z-10 → zIndex: 10', () => {
      const result = resolver.resolve(['z-10']);
      expect(result).toEqual({ zIndex: '10' });
    });

    it('z-50 → zIndex: 50', () => {
      const result = resolver.resolve(['z-50']);
      expect(result).toEqual({ zIndex: '50' });
    });

    it('z-auto → zIndex: auto', () => {
      const result = resolver.resolve(['z-auto']);
      expect(result).toEqual({ zIndex: 'auto' });
    });

    it('z-[100] → zIndex: 100', () => {
      const result = resolver.resolve(['z-[100]']);
      expect(result).toEqual({ zIndex: '100' });
    });
  });

  describe('Focus pseudo-class 상태 파싱', () => {
    it('focus:ring-2 → focus 상태로 분리', () => {
      const result = resolver.resolveWithStates([
        'bg-bg-accent',
        'focus:ring-2',
        'focus:ring-focus',
      ]);

      expect(result.default).toEqual({
        backgroundColor: 'color/role/bg/accent (#0033a0)',
      });
      expect(result.focus?.boxShadow).toContain('0 0 0 2px');
    });

    it('focus:outline-none → focus 상태로 분리', () => {
      const result = resolver.resolveWithStates([
        'bg-bg-accent',
        'focus:outline-none',
      ]);

      expect(result.default?.backgroundColor).toBe('color/role/bg/accent (#0033a0)');
      expect(result.focus?.outline).toBe('none');
    });

    it('focus:bg-bg-surface → focus 상태로 분리', () => {
      const result = resolver.resolveWithStates([
        'bg-bg-accent',
        'focus:bg-bg-surface',
      ]);

      expect(result.default?.backgroundColor).toBe('color/role/bg/accent (#0033a0)');
      expect(result.focus?.backgroundColor).toBe('#ffffff');
    });

    it('getStateStyles로 focus 상태 조회', () => {
      const result = resolver.getStateStyles(
        ['bg-bg-accent', 'focus:ring-2', 'focus:ring-focus'],
        'focus'
      );

      expect(result.boxShadow).toBeDefined();
    });
  });
});
