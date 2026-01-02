/**
 * Storybook Validator MCP Server
 * Claude Desktop에서 컴포넌트 스타일을 조회하는 MCP Extension
 */
import { listComponents } from './tools/list';
import { getImplementedStyle } from './tools/styles';
import type {
  ListComponentsInput,
  ListComponentsOutput,
  GetImplementedStyleInput,
  GetImplementedStyleOutput,
} from './types';

/**
 * Tool 스키마 정의
 */
interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP Server 클래스
 */
export class StorybookValidatorServer {
  readonly name = 'storybook-validator';
  readonly version = '1.0.0';

  private basePath: string;
  private tools: Map<string, ToolSchema>;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.tools = new Map();
    this.registerTools();
  }

  /**
   * Tool 등록
   */
  private registerTools(): void {
    // list_components Tool
    this.tools.set('list_components', {
      name: 'list_components',
      description: '구현된 컴포넌트 목록을 조회합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: '컴포넌트 카테고리 필터 (예: "button", "form")',
          },
        },
      },
    });

    // get_implemented_style Tool
    this.tools.set('get_implemented_style', {
      name: 'get_implemented_style',
      description: 'Storybook 컴포넌트 스타일을 조회합니다. state 파라미터로 hover, focus-visible, active 상태의 스타일도 조회할 수 있습니다.',
      inputSchema: {
        type: 'object',
        properties: {
          component: {
            type: 'string',
            description: '컴포넌트명 (필수)',
          },
          variant: {
            type: 'string',
            description: 'variant (예: "primary", "secondary")',
          },
          size: {
            type: 'string',
            description: 'size (예: "sm", "md", "lg")',
          },
          property: {
            type: 'string',
            description: '특정 속성만 조회 (예: "padding", "backgroundColor")',
          },
          state: {
            type: 'string',
            enum: ['default', 'hover', 'focus-visible', 'active', 'all'],
            description: '상태별 스타일 조회. "all"은 모든 상태를 반환, 특정 상태명은 해당 상태만 반환 (예: "focus-visible")',
          },
        },
        required: ['component'],
      },
    });
  }

  /**
   * 등록된 Tool 목록 반환
   */
  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Tool 스키마 반환
   */
  getToolSchema(toolName: string): ToolSchema | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Tool 실행
   */
  async callTool(
    toolName: string,
    input: unknown
  ): Promise<ListComponentsOutput | GetImplementedStyleOutput> {
    if (!this.tools.has(toolName)) {
      throw new Error(`Tool '${toolName}'을(를) 찾을 수 없습니다.`);
    }

    switch (toolName) {
      case 'list_components':
        return listComponents(input as ListComponentsInput, this.basePath);

      case 'get_implemented_style':
        return getImplementedStyle(
          input as GetImplementedStyleInput,
          this.basePath
        );

      /* v8 ignore next 3 */
      default:
        throw new Error(`Tool '${toolName}'을(를) 찾을 수 없습니다.`);
    }
  }
}

/**
 * MCP Server 인스턴스 생성
 */
export function createMcpServer(basePath: string): StorybookValidatorServer {
  return new StorybookValidatorServer(basePath);
}

// 타입 재내보내기
export * from './types';
export * from './tools';
