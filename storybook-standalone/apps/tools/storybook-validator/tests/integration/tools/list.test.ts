/**
 * list_components Tool 통합 테스트
 * TDD: RED → GREEN → REFACTOR
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { listComponents } from '../../../src/tools/list';
import type { ListComponentsInput, ListComponentsOutput } from '../../../src/types';
import path from 'path';

const FIXTURES_PATH = path.join(__dirname, '../../unit/fixtures');

describe('list_components Tool', () => {
  describe('전체 컴포넌트 목록 조회', () => {
    it('모든 컴포넌트 목록을 반환한다', async () => {
      const input: ListComponentsInput = {};
      const result = await listComponents(input, FIXTURES_PATH);

      expect(result).toBeDefined();
      expect(result.total).toBe(3);
      expect(result.components).toHaveLength(3);
    });

    it('각 컴포넌트의 name, variants, sizes를 포함한다', async () => {
      const input: ListComponentsInput = {};
      const result = await listComponents(input, FIXTURES_PATH);

      // button 컴포넌트 확인
      const button = result.components.find((c) => c.name === 'button');
      expect(button).toBeDefined();
      expect(button?.variants).toContain('primary');
      expect(button?.variants).toContain('secondary');
      expect(button?.variants).toContain('outline');
      expect(button?.sizes).toContain('sm');
      expect(button?.sizes).toContain('md');
      expect(button?.sizes).toContain('lg');
    });

    it('badge 컴포넌트는 type과 variant를 가진다', async () => {
      const input: ListComponentsInput = {};
      const result = await listComponents(input, FIXTURES_PATH);

      const badge = result.components.find((c) => c.name === 'badge');
      expect(badge).toBeDefined();
      // badge는 type: level, status, dot / variant: solid, subtle
      // variants에는 variant 속성 값들이 들어감
      expect(badge?.variants).toContain('solid');
      expect(badge?.variants).toContain('subtle');
    });

    it('iconButton 컴포넌트 정보를 포함한다', async () => {
      const input: ListComponentsInput = {};
      const result = await listComponents(input, FIXTURES_PATH);

      const iconButton = result.components.find((c) => c.name === 'iconButton');
      expect(iconButton).toBeDefined();
      expect(iconButton?.variants).toContain('ghost');
      expect(iconButton?.variants).toContain('secondary');
      expect(iconButton?.variants).toContain('tertiary');
      expect(iconButton?.sizes).toContain('sm');
      expect(iconButton?.sizes).toContain('md');
      expect(iconButton?.sizes).toContain('lg');
    });
  });

  describe('카테고리 필터링', () => {
    it('category로 컴포넌트 필터링 (button) - 부분 일치', async () => {
      const input: ListComponentsInput = { category: 'button' };
      const result = await listComponents(input, FIXTURES_PATH);

      // "button"은 button, iconButton 모두 포함
      expect(result.total).toBe(2);
      expect(result.components).toHaveLength(2);

      const names = result.components.map((c) => c.name);
      expect(names).toContain('button');
      expect(names).toContain('iconButton');
    });

    it('category로 컴포넌트 필터링 (icon)', async () => {
      const input: ListComponentsInput = { category: 'icon' };
      const result = await listComponents(input, FIXTURES_PATH);

      // iconButton이 매칭됨
      expect(result.total).toBe(1);
      expect(result.components[0].name).toBe('iconButton');
    });

    it('일치하는 컴포넌트가 없으면 빈 목록', async () => {
      const input: ListComponentsInput = { category: 'nonexistent' };
      const result = await listComponents(input, FIXTURES_PATH);

      expect(result.total).toBe(0);
      expect(result.components).toHaveLength(0);
    });
  });

  describe('출력 포맷', () => {
    it('ListComponentsOutput 형식을 준수한다', async () => {
      const input: ListComponentsInput = {};
      const result = await listComponents(input, FIXTURES_PATH);

      // 타입 검증
      expect(typeof result.total).toBe('number');
      expect(Array.isArray(result.components)).toBe(true);

      for (const comp of result.components) {
        expect(typeof comp.name).toBe('string');
        expect(Array.isArray(comp.variants)).toBe(true);
        expect(Array.isArray(comp.sizes)).toBe(true);
      }
    });
  });

  describe('에러 처리', () => {
    it('존재하지 않는 경로 → 에러 발생', async () => {
      const input: ListComponentsInput = {};
      const invalidPath = '/nonexistent/path';

      await expect(listComponents(input, invalidPath)).rejects.toThrow();
    });
  });
});
