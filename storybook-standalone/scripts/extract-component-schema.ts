#!/usr/bin/env tsx
/**
 * Component Schema Extractor
 *
 * Storybook index.json과 react-docgen-typescript를 결합하여
 * 완전한 컴포넌트 스키마 JSON을 생성합니다.
 *
 * 사용법: pnpm schema:extract
 * 출력: dist/component-schema.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { withCompilerOptions } from 'react-docgen-typescript';
import type { ComponentDoc, PropItem } from 'react-docgen-typescript';

// ============================================================================
// Types
// ============================================================================

interface StorybookEntry {
  id: string;
  title: string;
  name: string;
  importPath: string;
  componentPath?: string;
  type?: 'story' | 'docs';
  tags?: string[];
}

interface StorybookIndex {
  v: number;
  entries: Record<string, StorybookEntry>;
}

interface PropSchema {
  type: string | string[];
  required: boolean;
  defaultValue?: unknown;
  description?: string;
}

interface StorySchema {
  id: string;
  name: string;
  tags?: string[];
}

interface ComponentSchema {
  displayName: string;
  filePath: string;
  category: string;
  props: Record<string, PropSchema>;
  stories: StorySchema[];
}

interface CombinedSchema {
  version: string;
  generatedAt: string;
  components: Record<string, ComponentSchema>;
}

// ============================================================================
// Configuration
// ============================================================================

const ROOT_DIR = path.resolve(__dirname, '..');
const STORYBOOK_INDEX_PATH = path.join(
  ROOT_DIR,
  'apps/storybook/storybook-static/index.json'
);
const OUTPUT_PATH = path.join(ROOT_DIR, 'dist/component-schema.json');

// react-docgen-typescript 파서 설정
const parser = withCompilerOptions(
  {
    esModuleInterop: true,
    jsx: 4, // JsxEmit.ReactJSX
  },
  {
    savePropValueAsString: true,
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    propFilter: (prop: PropItem) => {
      // HTML 기본 속성 및 내부 속성 필터링
      if (prop.declarations && prop.declarations.length > 0) {
        const hasPropAdditionalDescription = prop.declarations.find((decl) => {
          return !decl.fileName.includes('node_modules');
        });
        return !!hasPropAdditionalDescription;
      }
      return true;
    },
  }
);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 상대 경로를 절대 경로로 변환 (storybook 앱 기준)
 */
function resolveComponentPath(componentPath: string): string {
  // componentPath: "../../packages/ui/src/components/Button.tsx"
  // apps/storybook 기준으로 상대 경로 해석
  const storybookDir = path.join(ROOT_DIR, 'apps/storybook');
  return path.resolve(storybookDir, componentPath);
}

/**
 * 절대 경로를 프로젝트 루트 기준 상대 경로로 변환
 */
function toRelativePath(absolutePath: string): string {
  return path.relative(ROOT_DIR, absolutePath);
}

/**
 * 타이틀에서 카테고리 추출 (예: "UI/Button" -> "UI")
 */
function extractCategory(title: string): string {
  const parts = title.split('/');
  return parts.length > 1 ? parts[0] : 'Uncategorized';
}

/**
 * PropItem에서 타입 정보 추출
 */
function extractPropType(prop: PropItem): string | string[] {
  const typeName = prop.type.name;

  // enum 타입 처리 (예: "primary" | "secondary" | "tertiary")
  if (typeName === 'enum' && prop.type.value) {
    const values = prop.type.value as Array<{ value: string }>;
    return values
      .map((v) => v.value.replace(/^['"]|['"]$/g, '')) // 따옴표 제거
      .filter(Boolean);
  }

  // 유니온 타입 처리
  if (typeName.includes(' | ')) {
    return typeName
      .split(' | ')
      .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  return typeName;
}

/**
 * 기본값 파싱
 */
function parseDefaultValue(
  defaultValue: PropItem['defaultValue']
): unknown | undefined {
  if (!defaultValue || defaultValue.value === undefined) {
    return undefined;
  }

  const value = defaultValue.value;

  // boolean 파싱
  if (value === 'true') return true;
  if (value === 'false') return false;

  // number 파싱
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;

  // 따옴표 제거된 문자열 반환
  return value.replace(/^['"]|['"]$/g, '');
}

// ============================================================================
// Main Logic
// ============================================================================

async function main(): Promise<void> {
  console.log('🔍 Component Schema Extractor 시작...\n');

  // 1. Storybook index.json 읽기
  console.log('📖 Storybook index.json 읽는 중...');
  if (!fs.existsSync(STORYBOOK_INDEX_PATH)) {
    console.error(
      `❌ Storybook index.json을 찾을 수 없습니다: ${STORYBOOK_INDEX_PATH}`
    );
    console.error('   먼저 pnpm build:storybook을 실행해주세요.');
    process.exit(1);
  }

  const storybookIndex: StorybookIndex = JSON.parse(
    fs.readFileSync(STORYBOOK_INDEX_PATH, 'utf-8')
  );
  console.log(`   ✅ ${Object.keys(storybookIndex.entries).length}개 엔트리 발견\n`);

  // 2. 컴포넌트별로 스토리 그룹화
  console.log('📊 컴포넌트별 스토리 그룹화...');
  const componentStories = new Map<
    string,
    { title: string; stories: StorybookEntry[] }
  >();

  for (const entry of Object.values(storybookIndex.entries)) {
    // docs 타입은 건너뛰기
    if (entry.type === 'docs') continue;

    const componentPath = entry.componentPath;
    if (!componentPath) continue;

    const absolutePath = resolveComponentPath(componentPath);
    const relativePath = toRelativePath(absolutePath);

    if (!componentStories.has(relativePath)) {
      componentStories.set(relativePath, {
        title: entry.title,
        stories: [],
      });
    }

    componentStories.get(relativePath)!.stories.push(entry);
  }

  console.log(`   ✅ ${componentStories.size}개 컴포넌트 발견\n`);

  // 3. react-docgen-typescript로 Props 추출
  console.log('🔧 컴포넌트 Props 추출 중...');
  const combinedSchema: CombinedSchema = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    components: {},
  };

  for (const [relativePath, { title, stories }] of Array.from(componentStories.entries())) {
    const absolutePath = path.join(ROOT_DIR, relativePath);

    // 파일 존재 확인
    if (!fs.existsSync(absolutePath)) {
      console.warn(`   ⚠️  파일 없음: ${relativePath}`);
      continue;
    }

    // 디렉토리인 경우 index 파일 찾기
    let targetPath = absolutePath;
    if (fs.statSync(absolutePath).isDirectory()) {
      const indexTsx = path.join(absolutePath, 'index.tsx');
      const indexTs = path.join(absolutePath, 'index.ts');

      if (fs.existsSync(indexTsx)) {
        targetPath = indexTsx;
      } else if (fs.existsSync(indexTs)) {
        targetPath = indexTs;
      } else {
        // index 파일이 없으면 디렉토리 내 모든 .tsx 파일 파싱
        const tsxFiles = fs.readdirSync(absolutePath)
          .filter(f => f.endsWith('.tsx'))
          .map(f => path.join(absolutePath, f));

        if (tsxFiles.length === 0) {
          console.warn(`   ⚠️  .tsx 파일 없음: ${relativePath}`);
          continue;
        }

        // 디렉토리 내 모든 .tsx 파일 파싱
        for (const tsxFile of tsxFiles) {
          try {
            const docs: ComponentDoc[] = parser.parse(tsxFile);
            for (const doc of docs) {
              const propsSchema: Record<string, PropSchema> = {};
              for (const [propName, propInfo] of Object.entries(doc.props)) {
                propsSchema[propName] = {
                  type: extractPropType(propInfo),
                  required: propInfo.required,
                  ...(propInfo.defaultValue && {
                    defaultValue: parseDefaultValue(propInfo.defaultValue),
                  }),
                  ...(propInfo.description && { description: propInfo.description }),
                };
              }

              const storiesSchema: StorySchema[] = stories.map((s) => ({
                id: s.id,
                name: s.name,
                ...(s.tags && s.tags.length > 0 && { tags: s.tags }),
              }));

              const displayName = doc.displayName || path.basename(tsxFile, '.tsx');
              combinedSchema.components[displayName] = {
                displayName,
                filePath: toRelativePath(tsxFile),
                category: extractCategory(title),
                props: propsSchema,
                stories: storiesSchema,
              };

              console.log(
                `   ✅ ${displayName}: ${Object.keys(propsSchema).length}개 props, ${storiesSchema.length}개 stories`
              );
            }
          } catch (error) {
            // 개별 파일 오류는 무시
          }
        }
        continue;
      }
    }

    try {
      let docs: ComponentDoc[] = parser.parse(targetPath);

      // Compound Component fallback: forwardRef + as 타입 캐스팅 패턴 처리
      // (예: Dialog, Drawer 등 export { X } where X = XRoot as XComponent)
      if (docs.length === 0) {
        const fileContent = fs.readFileSync(targetPath, 'utf-8');
        const propsMatch = fileContent.match(/export\s+interface\s+(\w+Props)\b/);
        const displayNameMatch = fileContent.match(/\.displayName\s*=\s*['"](\w+)['"];?\s*\n/);

        if (propsMatch && displayNameMatch) {
          const propsName = propsMatch[1];
          const componentName = displayNameMatch[1];
          const tmpPath = targetPath.replace(/\.tsx$/, '.__compound_fallback__.tsx');
          const tmpContent = [
            `import React from 'react';`,
            `import type { ${propsName} } from './${path.basename(targetPath, '.tsx')}';`,
            `const ${componentName}: React.FC<${propsName}> = () => null;`,
            `${componentName}.displayName = '${componentName}';`,
            `export { ${componentName} };`,
          ].join('\n');

          fs.writeFileSync(tmpPath, tmpContent);
          try {
            docs = parser.parse(tmpPath);
          } finally {
            fs.unlinkSync(tmpPath);
          }

          if (docs.length > 0) {
            console.log(`   🔄 Compound Component fallback: ${componentName} (${propsName})`);
          }
        }

        if (docs.length === 0) {
          console.warn(`   ⚠️  Props 없음: ${relativePath}`);
          continue;
        }
      }

      for (const doc of docs) {
        // Props 변환
        const propsSchema: Record<string, PropSchema> = {};
        for (const [propName, propInfo] of Object.entries(doc.props)) {
          propsSchema[propName] = {
            type: extractPropType(propInfo),
            required: propInfo.required,
            ...(propInfo.defaultValue && {
              defaultValue: parseDefaultValue(propInfo.defaultValue),
            }),
            ...(propInfo.description && { description: propInfo.description }),
          };
        }

        // 스토리 정보 변환
        const storiesSchema: StorySchema[] = stories.map((s) => ({
          id: s.id,
          name: s.name,
          ...(s.tags && s.tags.length > 0 && { tags: s.tags }),
        }));

        // 컴포넌트 스키마 추가
        const displayName = doc.displayName || path.basename(relativePath, '.tsx');
        combinedSchema.components[displayName] = {
          displayName,
          filePath: relativePath,
          category: extractCategory(title),
          props: propsSchema,
          stories: storiesSchema,
        };

        console.log(
          `   ✅ ${displayName}: ${Object.keys(propsSchema).length}개 props, ${storiesSchema.length}개 stories`
        );
      }
    } catch (error) {
      console.error(`   ❌ 파싱 실패: ${relativePath}`);
      console.error(`      ${error instanceof Error ? error.message : error}`);
    }
  }

  // 4. Completeness check: Storybook에서 발견되지 않은 컴포넌트 스캔
  console.log('\n🔍 Completeness check: Storybook 미발견 컴포넌트 스캔 중...');

  const COMPONENT_DIRS = [
    path.join(ROOT_DIR, 'packages/ui/src/components'),
    path.join(ROOT_DIR, 'packages/ui/src/layout'),
  ];

  for (const dir of COMPONENT_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir).filter((f) => {
      if (f === 'index.ts' || f === 'index.tsx' || f === 'utils.ts') return false;
      const fullPath = path.join(dir, f);
      return f.endsWith('.tsx') || fs.statSync(fullPath).isDirectory();
    });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);

      if (fs.statSync(fullPath).isDirectory()) {
        // 디렉토리: 내부 .tsx 파일 모두 스캔 (index.ts는 re-export만 하므로 제외)
        const tsxFiles = fs.readdirSync(fullPath)
          .filter((f) => f.endsWith('.tsx'))
          .map((f) => path.join(fullPath, f));

        for (const tsxFile of tsxFiles) {
          try {
            const docs: ComponentDoc[] = parser.parse(tsxFile);
            for (const doc of docs) {
              if (combinedSchema.components[doc.displayName]) continue;

              const propsSchema: Record<string, PropSchema> = {};
              for (const [propName, propInfo] of Object.entries(doc.props)) {
                propsSchema[propName] = {
                  type: extractPropType(propInfo),
                  required: propInfo.required,
                  ...(propInfo.defaultValue && { defaultValue: parseDefaultValue(propInfo.defaultValue) }),
                  ...(propInfo.description && { description: propInfo.description }),
                };
              }

              // 0-props 항목 건너뛰기 (유틸리티 함수, 상수, 타입 등)
              if (Object.keys(propsSchema).length === 0) continue;

              const category = dir.includes('/layout') ? 'Layout' : 'UI';
              combinedSchema.components[doc.displayName] = {
                displayName: doc.displayName,
                filePath: toRelativePath(tsxFile),
                category,
                props: propsSchema,
                stories: [],
              };

              console.log(
                `   ⚠️  ${doc.displayName}: ${Object.keys(propsSchema).length}개 props (Storybook 미발견 — completeness check)`
              );
            }
          } catch (error) {
            // 개별 파일 파싱 오류 무시
          }
        }
      } else {
        // 단일 .tsx 파일
        try {
          const docs: ComponentDoc[] = parser.parse(fullPath);
          for (const doc of docs) {
            if (combinedSchema.components[doc.displayName]) continue;

            const propsSchema: Record<string, PropSchema> = {};
            for (const [propName, propInfo] of Object.entries(doc.props)) {
              propsSchema[propName] = {
                type: extractPropType(propInfo),
                required: propInfo.required,
                ...(propInfo.defaultValue && { defaultValue: parseDefaultValue(propInfo.defaultValue) }),
                ...(propInfo.description && { description: propInfo.description }),
              };
            }

            // 0-props 항목 건너뛰기 (유틸리티 함수, 상수, 타입 등)
            if (Object.keys(propsSchema).length === 0) continue;

            const category = dir.includes('/layout') ? 'Layout' : 'UI';
            combinedSchema.components[doc.displayName] = {
              displayName: doc.displayName,
              filePath: toRelativePath(fullPath),
              category,
              props: propsSchema,
              stories: [],
            };

            console.log(
              `   ⚠️  ${doc.displayName}: ${Object.keys(propsSchema).length}개 props (Storybook 미발견 — completeness check)`
            );
          }
        } catch (error) {
          // 파싱 오류 무시
        }
      }
    }
  }

  // 5. 결과 저장
  console.log('\n💾 결과 저장 중...');
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(combinedSchema, null, 2), 'utf-8');

  console.log(`   ✅ ${OUTPUT_PATH}`);
  console.log(
    `\n🎉 완료! ${Object.keys(combinedSchema.components).length}개 컴포넌트 스키마 생성됨`
  );
}

main().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
