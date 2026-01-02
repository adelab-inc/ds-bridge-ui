/**
 * Storybook Validator MCP Server Entry Point
 *
 * MCP Inspector 및 Claude Desktop에서 사용하는 진입점
 * @modelcontextprotocol/sdk를 사용하여 stdio transport로 통신
 */
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { listComponents } from './tools/list.js';
import { getImplementedStyle } from './tools/styles.js';
import {
  isListComponentsInput,
  isGetImplementedStyleInput,
} from './types/index.js';

// ESM에서 __dirname 폴리필
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 디버그 로그 (stderr로 출력하여 MCP JSON 통신에 영향 없음)
 */
function debugLog(message: string): void {
  if (process.env.DEBUG_MCP) {
    console.error(`[storybook-validator] ${message}`);
  }
}

/**
 * 경로 해결 전략 (강건한 다중 fallback):
 * 1순위: import.meta.url 기반 (../data relative to server/index.js)
 * 2순위: process.argv[1] 기반 (Node 실행 경로에서 추론)
 * 3순위: user_config 환경변수 - 개발자용
 * 4순위: 테스트 픽스처 - 개발 환경용
 */
function resolveDataPath(): string {
  const requiredFiles = ['component-definitions.json', 'design-tokens.json'];

  // 1. import.meta.url 기반 (../data relative to server/index.js)
  const bundledPath = join(__dirname, '..', 'data');
  debugLog(`Trying import.meta.url path: ${bundledPath}`);
  if (requiredFiles.every(f => existsSync(join(bundledPath, f)))) {
    debugLog(`Found data at: ${bundledPath}`);
    return bundledPath;
  }

  // 2. process.argv[1] 기반 (Node가 실행한 스크립트 경로에서 추론)
  if (process.argv[1]) {
    const scriptDir = dirname(process.argv[1]);
    const argvBasedPath = join(scriptDir, '..', 'data');
    debugLog(`Trying argv path: ${argvBasedPath}`);
    if (requiredFiles.every(f => existsSync(join(argvBasedPath, f)))) {
      debugLog(`Found data at: ${argvBasedPath}`);
      return argvBasedPath;
    }

    // 2-1. argv 경로에서 server/ 없이 바로 data/ 시도
    const directDataPath = join(scriptDir, 'data');
    debugLog(`Trying direct data path: ${directDataPath}`);
    if (requiredFiles.every(f => existsSync(join(directDataPath, f)))) {
      debugLog(`Found data at: ${directDataPath}`);
      return directDataPath;
    }
  }

  // 3. 환경변수 경로 (Claude Desktop user_config)
  if (process.env.UI_PACKAGE_PATH) {
    debugLog(`Using UI_PACKAGE_PATH: ${process.env.UI_PACKAGE_PATH}`);
    return process.env.UI_PACKAGE_PATH;
  }

  // 4. 테스트 픽스처 (fallback)
  debugLog('Falling back to test fixtures');
  return './tests/unit/fixtures';
}

const basePath = resolveDataPath();

/**
 * MCP Server 생성
 */
const server = new Server(
  {
    name: 'storybook-validator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: { listChanged: true },
    },
  }
);

/**
 * Tool 목록 핸들러
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_components',
        description:
          '구현된 컴포넌트 목록을 조회합니다. 카테고리로 필터링할 수 있습니다.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            category: {
              type: 'string',
              description: '컴포넌트 카테고리 필터 (예: "button", "form")',
            },
          },
        },
      },
      {
        name: 'get_implemented_style',
        description:
          'Storybook 컴포넌트의 실제 스타일 값을 조회합니다. TailwindCSS 클래스를 실제 CSS 값으로 변환하여 반환합니다. state 파라미터로 hover/focus-visible/active 상태 스타일도 조회할 수 있습니다.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            component: {
              type: 'string',
              description: '컴포넌트명 (필수, 예: "button", "badge")',
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
              description: '상태별 스타일 조회. "all"은 모든 상태 반환, "focus-visible"은 포커스 상태만 반환',
            },
          },
          required: ['component'],
        },
      },
    ],
  };
});

/**
 * Tool 호출 핸들러
 */
server.setRequestHandler(
  CallToolRequestSchema,
  async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'list_components': {
          if (!isListComponentsInput(args)) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ 오류: 잘못된 입력 형식입니다.',
                },
              ],
              isError: true,
            };
          }
          const result = await listComponents(args ?? {}, basePath);

          // 포맷팅된 텍스트 생성
          const lines = [`📦 컴포넌트 목록 (${result.total}개)`, ''];
          for (const comp of result.components) {
            const variants =
              comp.variants.length > 0 ? comp.variants.join(', ') : '-';
            const sizes = comp.sizes.length > 0 ? comp.sizes.join(', ') : '-';
            lines.push(`• ${comp.name}: ${variants} | ${sizes}`);
          }

          return {
            content: [
              {
                type: 'text',
                text: lines.join('\n'),
              },
            ],
          };
        }

        case 'get_implemented_style': {
          if (!isGetImplementedStyleInput(args)) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ 오류: component 파라미터가 필요합니다.',
                },
              ],
              isError: true,
            };
          }

          const result = await getImplementedStyle(args, basePath);

          // 포맷팅된 텍스트 생성
          const lines = [
            `📐 ${result.component} ${result.variant} ${result.size}`,
            '',
          ];

          // 기본 스타일 출력
          if (result.stateStyles) {
            lines.push('기본 스타일:');
          }
          for (const [key, value] of Object.entries(result.styles)) {
            lines.push(`${key}: ${value}`);
          }

          // stateStyles 출력 (state 파라미터가 있을 때)
          if (result.stateStyles) {
            for (const [state, styles] of Object.entries(result.stateStyles)) {
              lines.push('', `${state} 상태:`);
              for (const [key, value] of Object.entries(styles)) {
                lines.push(`${key}: ${value}`);
              }
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: lines.join('\n'),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `❌ 오류: 알 수 없는 Tool '${name}'`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ 오류: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * 서버 시작
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 프로세스 종료 시 정리
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('MCP Server 시작 실패:', error);
  process.exit(1);
});
