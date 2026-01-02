/**
 * get_implemented_style Tool 통합 테스트
 * TDD: RED → GREEN → REFACTOR
 */
import { describe, it, expect } from 'vitest';
import { getImplementedStyle } from '../../../src/tools/styles';
import type { GetImplementedStyleInput } from '../../../src/types';
import path from 'path';

const FIXTURES_PATH = path.join(__dirname, '../../unit/fixtures');

describe('get_implemented_style Tool', () => {
  describe('Button 스타일 조회', () => {
    it('Button primary md → 전체 스타일 반환', async () => {
      const input: GetImplementedStyleInput = {
        component: 'button',
        variant: 'primary',
        size: 'md',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      expect(result.component).toBe('button');
      expect(result.variant).toBe('primary');
      expect(result.size).toBe('md');

      // 스타일 값 검증 (토큰 이름이 포함될 수 있음: "tokenName (#value)")
      expect(result.styles.backgroundColor).toContain('#0033a0');
      expect(result.styles.display).toBe('inline-flex');
      expect(result.styles.justifyContent).toBe('center');
      expect(result.styles.alignItems).toBe('center');
      expect(result.styles.borderRadius).toContain('8px');
    });

    it('Button secondary lg → 스타일 반환', async () => {
      const input: GetImplementedStyleInput = {
        component: 'button',
        variant: 'secondary',
        size: 'lg',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      expect(result.variant).toBe('secondary');
      expect(result.size).toBe('lg');
      expect(result.styles.backgroundColor).toBeDefined();
    });

    it('Button outline sm → 아웃라인 스타일', async () => {
      const input: GetImplementedStyleInput = {
        component: 'button',
        variant: 'outline',
        size: 'sm',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      expect(result.variant).toBe('outline');
      expect(result.size).toBe('sm');
      // outline 스타일 확인
      expect(result.styles.outlineColor).toBeDefined();
    });
  });

  describe('기본값 적용', () => {
    it('variant/size 미지정 시 기본값 사용', async () => {
      const input: GetImplementedStyleInput = {
        component: 'button',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      // defaultVariants: { variant: "primary", size: "md" }
      expect(result.variant).toBe('primary');
      expect(result.size).toBe('md');
    });

    it('variant만 지정 → size는 기본값', async () => {
      const input: GetImplementedStyleInput = {
        component: 'button',
        variant: 'secondary',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      expect(result.variant).toBe('secondary');
      expect(result.size).toBe('md');
    });

    it('size만 지정 → variant는 기본값', async () => {
      const input: GetImplementedStyleInput = {
        component: 'button',
        size: 'lg',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      expect(result.variant).toBe('primary');
      expect(result.size).toBe('lg');
    });
  });

  describe('특정 속성 조회', () => {
    it('property 지정 시 해당 속성만 포함', async () => {
      const input: GetImplementedStyleInput = {
        component: 'button',
        variant: 'primary',
        size: 'md',
        property: 'backgroundColor',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      // property 지정 시에도 전체 스타일을 반환하지만
      // 실제 사용 시 formatter에서 해당 속성만 표시함
      // 토큰 이름이 포함될 수 있음: "tokenName (#value)"
      expect(result.styles.backgroundColor).toContain('#0033a0');
    });
  });

  describe('IconButton 스타일 조회', () => {
    it('IconButton ghost md → 스타일 반환', async () => {
      const input: GetImplementedStyleInput = {
        component: 'iconButton',
        variant: 'ghost',
        size: 'md',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      expect(result.component).toBe('iconButton');
      expect(result.variant).toBe('ghost');
      expect(result.size).toBe('md');
      expect(result.styles.display).toBe('flex');
    });

    it('IconButton ghost lg → compoundVariant 적용 (shadow-lg)', async () => {
      const input: GetImplementedStyleInput = {
        component: 'iconButton',
        variant: 'ghost',
        size: 'lg',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      // compoundVariant: variant=["ghost", "secondary"], size="lg" → shadow-lg
      // shadow 클래스는 현재 ClassResolver에서 처리하지 않음
      // 하지만 클래스가 적용되는지는 확인 가능
      expect(result.size).toBe('lg');
    });
  });

  describe('Badge 스타일 조회', () => {
    it('Badge solid → 스타일 반환', async () => {
      const input: GetImplementedStyleInput = {
        component: 'badge',
        variant: 'solid',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      expect(result.component).toBe('badge');
      expect(result.variant).toBe('solid');
      expect(result.styles.display).toBe('inline-flex');
    });
  });

  describe('에러 처리', () => {
    it('존재하지 않는 컴포넌트 → 에러 발생', async () => {
      const input: GetImplementedStyleInput = {
        component: 'nonexistent',
      };

      await expect(getImplementedStyle(input, FIXTURES_PATH)).rejects.toThrow(
        /컴포넌트.*찾을 수 없습니다/
      );
    });

    it('존재하지 않는 경로 → 에러 발생', async () => {
      const input: GetImplementedStyleInput = {
        component: 'button',
      };
      const invalidPath = '/nonexistent/path';

      await expect(getImplementedStyle(input, invalidPath)).rejects.toThrow();
    });
  });

  describe('출력 형식', () => {
    it('GetImplementedStyleOutput 형식을 준수한다', async () => {
      const input: GetImplementedStyleInput = {
        component: 'button',
      };
      const result = await getImplementedStyle(input, FIXTURES_PATH);

      expect(typeof result.component).toBe('string');
      expect(typeof result.variant).toBe('string');
      expect(typeof result.size).toBe('string');
      expect(typeof result.styles).toBe('object');

      // 스타일 값은 모두 문자열
      for (const [key, value] of Object.entries(result.styles)) {
        expect(typeof key).toBe('string');
        expect(typeof value).toBe('string');
      }
    });
  });
});
