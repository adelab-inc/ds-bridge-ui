/**
 * token-reader.ts 단위 테스트
 * TDD: RED → GREEN → REFACTOR
 */
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { TokenReader } from '../../../src/utils/token-reader';

describe('TokenReader', () => {
  let reader: TokenReader;
  const fixturesPath = path.join(__dirname, '../fixtures');

  beforeAll(() => {
    reader = new TokenReader(fixturesPath);
  });

  describe('readComponentDefinitions', () => {
    it('component-definitions.json 전체를 읽어 반환', async () => {
      const definitions = await reader.readComponentDefinitions();

      expect(definitions).toBeDefined();
      expect(definitions).toHaveProperty('button');
      expect(definitions).toHaveProperty('badge');
      expect(definitions).toHaveProperty('iconButton');
    });

    it('읽은 데이터는 올바른 구조를 가짐', async () => {
      const definitions = await reader.readComponentDefinitions();
      const button = definitions.button;

      expect(button).toHaveProperty('base');
      expect(button).toHaveProperty('variants');
      expect(button).toHaveProperty('defaultVariants');
      expect(button.variants).toHaveProperty('variant');
      expect(button.variants).toHaveProperty('size');
    });
  });

  describe('getComponentDefinition', () => {
    it('button 컴포넌트 정의를 가져옴', async () => {
      const button = await reader.getComponentDefinition('button');

      expect(button).toBeDefined();
      expect(button?.base).toBe('inline-flex justify-center items-center py-component-inset-button-y');
      expect(button?.variants.variant.primary).toBe('bg-bg-accent');
    });

    it('badge 컴포넌트 정의를 가져옴', async () => {
      const badge = await reader.getComponentDefinition('badge');

      expect(badge).toBeDefined();
      expect(badge?.base).toContain('inline-flex items-center');
      expect(badge?.variants.type).toHaveProperty('level');
      expect(badge?.variants.type).toHaveProperty('dot');
    });

    it('존재하지 않는 컴포넌트는 null 반환', async () => {
      const unknown = await reader.getComponentDefinition('unknown-component');

      expect(unknown).toBeNull();
    });
  });

  describe('listComponents', () => {
    it('모든 컴포넌트 이름 목록을 반환', async () => {
      const components = await reader.listComponents();

      expect(components).toContain('button');
      expect(components).toContain('badge');
      expect(components).toContain('iconButton');
      expect(components.length).toBe(3);
    });

    it('반환된 목록은 배열', async () => {
      const components = await reader.listComponents();

      expect(Array.isArray(components)).toBe(true);
    });
  });

  describe('getComponentClasses', () => {
    it('button primary md의 클래스를 병합하여 반환', async () => {
      const classes = await reader.getComponentClasses('button', {
        variant: 'primary',
        size: 'md',
      });

      expect(classes).toContain('inline-flex');
      expect(classes).toContain('justify-center');
      expect(classes).toContain('items-center');
      expect(classes).toContain('bg-bg-accent');
      expect(classes).toContain('min-w-[52px]');
      expect(classes).toContain('text-button-md-medium');
    });

    it('button secondary lg의 클래스를 병합하여 반환', async () => {
      const classes = await reader.getComponentClasses('button', {
        variant: 'secondary',
        size: 'lg',
      });

      expect(classes).toContain('bg-bg-accent-secondary');
      expect(classes).toContain('min-w-[56px]');
      expect(classes).toContain('text-button-lg-medium');
    });

    it('variant/size 미지정 시 defaultVariants 사용', async () => {
      const classes = await reader.getComponentClasses('button', {});

      // defaultVariants: variant: "primary", size: "md"
      expect(classes).toContain('bg-bg-accent');
      expect(classes).toContain('min-w-[52px]');
    });

    it('compoundVariants 조건 매칭 시 클래스 추가', async () => {
      const classes = await reader.getComponentClasses('button', {
        variant: 'primary',
        isDisabled: false,
      });

      expect(classes).toContain('text-text-inverse');
    });

    it('compoundVariants 배열 조건 매칭 (variant가 배열인 경우)', async () => {
      const classes = await reader.getComponentClasses('iconButton', {
        variant: 'ghost',
        size: 'lg',
      });

      expect(classes).toContain('shadow-lg');
    });

    it('compoundVariants 배열 조건 불일치 (variant가 배열에 없는 경우)', async () => {
      const classes = await reader.getComponentClasses('iconButton', {
        variant: 'tertiary',
        size: 'lg',
      });

      expect(classes).not.toContain('shadow-lg');
    });

    it('존재하지 않는 컴포넌트는 빈 배열 반환', async () => {
      const classes = await reader.getComponentClasses('unknown', {});

      expect(classes).toEqual([]);
    });
  });

  describe('에러 처리', () => {
    it('잘못된 경로의 TokenReader는 파일 읽기 시 에러 발생', async () => {
      const badReader = new TokenReader('/invalid/path');

      await expect(badReader.readComponentDefinitions()).rejects.toThrow();
    });
  });

  describe('캐싱', () => {
    it('같은 파일을 두 번 읽어도 캐시된 데이터 반환', async () => {
      const first = await reader.readComponentDefinitions();
      const second = await reader.readComponentDefinitions();

      expect(first).toBe(second); // 같은 참조
    });
  });
});
