/**
 * formatter.ts 단위 테스트
 * TDD: RED → GREEN → REFACTOR
 */
import { describe, it, expect } from 'vitest';
import {
  formatComponentStyle,
  formatComponentList,
} from '../../../src/utils/formatter';
import type {
  GetImplementedStyleOutput,
  ListComponentsOutput,
} from '../../../src/types';

describe('formatComponentStyle', () => {
  describe('기본 포맷팅', () => {
    it('기본 스타일 출력: 📐 {Component} {variant} {size}', () => {
      const data: GetImplementedStyleOutput = {
        component: 'button',
        variant: 'primary',
        size: 'md',
        styles: {
          backgroundColor: '#0033A0',
        },
      };

      const result = formatComponentStyle(data);

      expect(result).toContain('📐 Button primary md');
      expect(result).toContain('backgroundColor: #0033A0');
    });

    it('여러 스타일 속성을 개행으로 구분', () => {
      const data: GetImplementedStyleOutput = {
        component: 'button',
        variant: 'primary',
        size: 'md',
        styles: {
          backgroundColor: '#0033A0',
          color: '#FFFFFF',
          padding: '8px 16px',
          borderRadius: '8px',
        },
      };

      const result = formatComponentStyle(data);

      expect(result).toContain('backgroundColor: #0033A0');
      expect(result).toContain('color: #FFFFFF');
      expect(result).toContain('padding: 8px 16px');
      expect(result).toContain('borderRadius: 8px');

      // 각 속성은 별도 줄에 있어야 함
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(5); // 헤더 + 빈줄 + 4개 속성
    });

    it('빈 스타일 객체 처리', () => {
      const data: GetImplementedStyleOutput = {
        component: 'button',
        variant: 'primary',
        size: 'md',
        styles: {},
      };

      const result = formatComponentStyle(data);

      expect(result).toContain('📐 Button primary md');
      expect(result).toContain('(스타일 없음)');
    });

    it('variant만 있는 경우', () => {
      const data: GetImplementedStyleOutput = {
        component: 'badge',
        variant: 'solid',
        size: '',
        styles: {
          backgroundColor: '#E5E7EB',
        },
      };

      const result = formatComponentStyle(data);

      expect(result).toContain('📐 Badge solid');
      expect(result).not.toContain('📐 Badge solid '); // 끝에 불필요한 공백 없음
    });

    it('size만 있는 경우', () => {
      const data: GetImplementedStyleOutput = {
        component: 'divider',
        variant: '',
        size: 'lg',
        styles: {
          height: '2px',
        },
      };

      const result = formatComponentStyle(data);

      expect(result).toContain('📐 Divider lg');
    });

    it('variant와 size 모두 없는 경우', () => {
      const data: GetImplementedStyleOutput = {
        component: 'separator',
        variant: '',
        size: '',
        styles: {
          borderColor: '#E5E7EB',
        },
      };

      const result = formatComponentStyle(data);

      expect(result).toBe(
        '📐 Separator\n\nborderColor: #E5E7EB'
      );
    });

    it('빈 컴포넌트명 처리', () => {
      const data: GetImplementedStyleOutput = {
        component: '',
        variant: 'primary',
        size: 'md',
        styles: {
          backgroundColor: '#0033A0',
        },
      };

      const result = formatComponentStyle(data);

      // capitalize('') returns '', so header starts with empty string
      expect(result).toContain('📐');
      expect(result).toContain('primary md');
      expect(result).toContain('backgroundColor: #0033A0');
    });
  });

  describe('특정 속성 조회', () => {
    it('특정 속성만 조회 시 한 줄 포맷', () => {
      const data: GetImplementedStyleOutput = {
        component: 'button',
        variant: 'primary',
        size: 'md',
        styles: {
          backgroundColor: '#0033A0',
          color: '#FFFFFF',
          padding: '8px 16px',
        },
      };

      const result = formatComponentStyle(data, { property: 'padding' });

      expect(result).toBe('Button primary md padding: 8px 16px');
    });

    it('특정 속성이 존재하지 않는 경우', () => {
      const data: GetImplementedStyleOutput = {
        component: 'button',
        variant: 'primary',
        size: 'md',
        styles: {
          backgroundColor: '#0033A0',
        },
      };

      const result = formatComponentStyle(data, { property: 'margin' });

      expect(result).toBe('Button primary md margin: (없음)');
    });
  });
});

describe('formatComponentList', () => {
  describe('기본 포맷팅', () => {
    it('기본 목록 포맷: 📦 컴포넌트 목록 (N개)', () => {
      const data: ListComponentsOutput = {
        components: [
          { name: 'button', variants: ['primary', 'secondary'], sizes: ['sm', 'md', 'lg'] },
          { name: 'badge', variants: ['solid', 'subtle'], sizes: ['sm', 'md'] },
        ],
        total: 2,
      };

      const result = formatComponentList(data);

      expect(result).toContain('📦 컴포넌트 목록 (2개)');
      expect(result).toContain('• button: primary, secondary | sm, md, lg');
      expect(result).toContain('• badge: solid, subtle | sm, md');
    });

    it('variants와 sizes를 | 로 구분', () => {
      const data: ListComponentsOutput = {
        components: [
          { name: 'input', variants: ['default', 'error'], sizes: ['sm', 'md', 'lg'] },
        ],
        total: 1,
      };

      const result = formatComponentList(data);

      expect(result).toContain('• input: default, error | sm, md, lg');
    });

    it('빈 목록 처리', () => {
      const data: ListComponentsOutput = {
        components: [],
        total: 0,
      };

      const result = formatComponentList(data);

      expect(result).toContain('📦 컴포넌트 목록 (0개)');
      expect(result).toContain('(없음)');
    });
  });

  describe('엣지 케이스', () => {
    it('variants만 있는 컴포넌트', () => {
      const data: ListComponentsOutput = {
        components: [
          { name: 'icon', variants: ['solid', 'outline'], sizes: [] },
        ],
        total: 1,
      };

      const result = formatComponentList(data);

      expect(result).toContain('• icon: solid, outline');
      expect(result).not.toContain('|'); // sizes가 없으면 | 없음
    });

    it('sizes만 있는 컴포넌트', () => {
      const data: ListComponentsOutput = {
        components: [
          { name: 'spacer', variants: [], sizes: ['sm', 'md', 'lg'] },
        ],
        total: 1,
      };

      const result = formatComponentList(data);

      expect(result).toContain('• spacer: sm, md, lg');
    });

    it('variants/sizes 모두 없는 컴포넌트', () => {
      const data: ListComponentsOutput = {
        components: [
          { name: 'separator', variants: [], sizes: [] },
        ],
        total: 1,
      };

      const result = formatComponentList(data);

      expect(result).toContain('• separator');
      expect(result).not.toContain('• separator:'); // : 없음
    });
  });
});
