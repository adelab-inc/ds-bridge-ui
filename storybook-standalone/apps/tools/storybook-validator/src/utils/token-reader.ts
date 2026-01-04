/**
 * 컴포넌트 정의 및 디자인 토큰 읽기 유틸리티
 * component-definitions.json 파일을 읽고 파싱
 */
import fs from 'fs/promises';
import path from 'path';
import type { ComponentDefinition } from '../types';

export interface ComponentDefinitions {
  [componentName: string]: ComponentDefinition;
}

export interface ComponentOptions {
  variant?: string;
  size?: string;
  [key: string]: string | boolean | undefined;
}

export class TokenReader {
  private basePath: string;
  private cache: ComponentDefinitions | null = null;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * component-definitions.json 전체를 읽어 반환
   *
   * 경로 탐색 우선순위:
   * 1. basePath/component-definitions.json (번들 또는 직접 경로)
   * 2. basePath/src/design-tokens/component-definitions.json (packages/ui 구조)
   */
  async readComponentDefinitions(): Promise<ComponentDefinitions> {
    if (this.cache) {
      return this.cache;
    }

    const searchPaths = [
      // 1순위: 번들 또는 직접 경로
      path.join(this.basePath, 'component-definitions.json'),
      // 2순위: packages/ui 구조
      path.join(
        this.basePath,
        'src',
        'design-tokens',
        'component-definitions.json'
      ),
    ];

    for (const filePath of searchPaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        this.cache = JSON.parse(content) as ComponentDefinitions;
        return this.cache;
      } catch {
        // 다음 경로 시도
      }
    }

    throw new Error(
      `component-definitions.json을 찾을 수 없습니다.\n검색 경로:\n  ${searchPaths.join('\n  ')}`
    );
  }

  /**
   * 특정 컴포넌트 정의를 가져옴
   */
  async getComponentDefinition(
    componentName: string
  ): Promise<ComponentDefinition | null> {
    const definitions = await this.readComponentDefinitions();
    return definitions[componentName] || null;
  }

  /**
   * 모든 컴포넌트 이름 목록을 반환
   */
  async listComponents(): Promise<string[]> {
    const definitions = await this.readComponentDefinitions();
    return Object.keys(definitions);
  }

  /**
   * 컴포넌트의 variant/size 조합에 맞는 클래스 배열 반환
   */
  async getComponentClasses(
    componentName: string,
    options: ComponentOptions
  ): Promise<string[]> {
    const definition = await this.getComponentDefinition(componentName);

    if (!definition) {
      return [];
    }

    const classes: string[] = [];

    // 1. base 클래스 추가
    if (definition.base) {
      classes.push(...this.splitClasses(definition.base));
    }

    // 2. defaultVariants로 미지정 옵션 보완
    const mergedOptions = { ...definition.defaultVariants, ...options };

    // 3. variants에서 옵션에 맞는 클래스 추가
    if (definition.variants) {
      for (const [variantKey, variantValues] of Object.entries(
        definition.variants
      )) {
        const selectedValue = mergedOptions[variantKey];

        if (selectedValue !== undefined && variantValues[String(selectedValue)]) {
          classes.push(
            ...this.splitClasses(variantValues[String(selectedValue)])
          );
        }
      }
    }

    // 4. compoundVariants 조건 매칭하여 클래스 추가
    if (definition.compoundVariants) {
      for (const compound of definition.compoundVariants) {
        if (this.matchesCompoundVariant(compound, mergedOptions)) {
          classes.push(...this.splitClasses(compound.class));
        }
      }
    }

    return classes;
  }

  /**
   * compoundVariant 조건이 현재 옵션과 매칭되는지 확인
   */
  private matchesCompoundVariant(
    compound: Record<string, unknown>,
    options: ComponentOptions
  ): boolean {
    for (const [key, value] of Object.entries(compound)) {
      if (key === 'class') continue;

      const optionValue = options[key];

      // 배열인 경우 (["primary", "secondary"])
      if (Array.isArray(value)) {
        if (!value.includes(optionValue)) {
          return false;
        }
      } else {
        // 단일 값인 경우
        if (optionValue !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 공백으로 분리된 클래스 문자열을 배열로 변환
   */
  private splitClasses(classString: string): string[] {
    return classString
      .split(/\s+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }
}
