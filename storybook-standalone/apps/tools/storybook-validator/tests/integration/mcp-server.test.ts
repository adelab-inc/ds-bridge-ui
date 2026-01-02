/**
 * MCP Server 통합 테스트
 * TDD: RED → GREEN → REFACTOR
 *
 * MCP 프로토콜 준수 및 Tool 등록 검증
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createMcpServer, StorybookValidatorServer } from '../../src/index';
import type { ListComponentsInput, GetImplementedStyleInput } from '../../src/types';
import { isListComponentsOutput, isGetImplementedStyleOutput } from '../../src/types';
import path from 'path';

const FIXTURES_PATH = path.join(__dirname, '../unit/fixtures');

describe('MCP Server', () => {
  let server: StorybookValidatorServer;

  beforeAll(() => {
    server = createMcpServer(FIXTURES_PATH);
  });

  describe('서버 생성', () => {
    it('MCP 서버 인스턴스를 생성한다', () => {
      expect(server).toBeDefined();
    });

    it('서버 이름이 storybook-validator이다', () => {
      expect(server.name).toBe('storybook-validator');
    });

    it('서버 버전이 정의되어 있다', () => {
      expect(server.version).toBeDefined();
      expect(typeof server.version).toBe('string');
    });
  });

  describe('Tool 등록', () => {
    it('list_components Tool이 등록되어 있다', () => {
      const tools = server.getRegisteredTools();
      expect(tools).toContain('list_components');
    });

    it('get_implemented_style Tool이 등록되어 있다', () => {
      const tools = server.getRegisteredTools();
      expect(tools).toContain('get_implemented_style');
    });

    it('총 2개의 Tool이 등록되어 있다', () => {
      const tools = server.getRegisteredTools();
      expect(tools).toHaveLength(2);
    });
  });

  describe('Tool 스키마', () => {
    it('list_components 스키마가 올바르다', () => {
      const schema = server.getToolSchema('list_components');
      if (!schema) {
        throw new Error('스키마가 정의되지 않았습니다');
      }

      expect(schema.name).toBe('list_components');
      expect(schema.description).toContain('컴포넌트');
    });

    it('get_implemented_style 스키마가 올바르다', () => {
      const schema = server.getToolSchema('get_implemented_style');
      if (!schema) {
        throw new Error('스키마가 정의되지 않았습니다');
      }

      expect(schema.name).toBe('get_implemented_style');
      expect(schema.description).toContain('스타일');
      expect(schema.inputSchema.properties).toHaveProperty('component');
    });
  });

  describe('Tool 실행', () => {
    it('list_components 실행 → 컴포넌트 목록 반환', async () => {
      const input: ListComponentsInput = {};
      const result = await server.callTool('list_components', input);

      expect(result).toBeDefined();
      if (!isListComponentsOutput(result)) {
        throw new Error('예상과 다른 출력 타입입니다');
      }
      expect(result.total).toBeGreaterThan(0);
      expect(Array.isArray(result.components)).toBe(true);
    });

    it('get_implemented_style 실행 → 스타일 반환', async () => {
      const input: GetImplementedStyleInput = {
        component: 'button',
        variant: 'primary',
        size: 'md',
      };
      const result = await server.callTool('get_implemented_style', input);

      expect(result).toBeDefined();
      if (!isGetImplementedStyleOutput(result)) {
        throw new Error('예상과 다른 출력 타입입니다');
      }
      expect(result.component).toBe('button');
      expect(result.styles).toBeDefined();
    });

    it('존재하지 않는 Tool 호출 → 에러', async () => {
      await expect(server.callTool('nonexistent', {})).rejects.toThrow(
        /Tool.*찾을 수 없습니다/
      );
    });
  });

  describe('에러 처리', () => {
    it('잘못된 입력 → 적절한 에러 메시지', async () => {
      const input: GetImplementedStyleInput = {
        component: 'nonexistent',
      };

      await expect(
        server.callTool('get_implemented_style', input)
      ).rejects.toThrow();
    });
  });
});
