/**
 * list_components Tool 구현
 * 구현된 컴포넌트 목록을 조회합니다.
 */
import { TokenReader } from '../utils/token-reader';
import type {
  ListComponentsInput,
  ListComponentsOutput,
  ComponentInfo,
} from '../types';

/**
 * 컴포넌트 목록 조회
 * @param input - 조회 조건 (category 필터 등)
 * @param basePath - component-definitions.json 위치
 */
export async function listComponents(
  input: ListComponentsInput,
  basePath: string
): Promise<ListComponentsOutput> {
  const reader = new TokenReader(basePath);
  const definitions = await reader.readComponentDefinitions();

  const components: ComponentInfo[] = [];

  for (const [name, definition] of Object.entries(definitions)) {
    // category 필터 적용
    if (input.category) {
      const normalizedCategory = input.category.toLowerCase();
      const normalizedName = name.toLowerCase();

      if (!normalizedName.includes(normalizedCategory)) {
        continue;
      }
    }

    // variants와 sizes 추출
    const variants: string[] = [];
    const sizes: string[] = [];

    if (definition.variants) {
      for (const [variantKey, variantValues] of Object.entries(
        definition.variants
      )) {
        const values = Object.keys(variantValues);

        if (variantKey === 'size') {
          sizes.push(...values);
        } else {
          // variant, type 등 다른 variants는 모두 variants에 추가
          variants.push(...values);
        }
      }
    }

    components.push({
      name,
      variants,
      sizes,
    });
  }

  return {
    components,
    total: components.length,
  };
}
