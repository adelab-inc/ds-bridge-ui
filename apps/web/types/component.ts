/**
 * Components API 타입 정의
 *
 * OpenAPI에서 자동 생성된 타입 사용
 */

import type {
  paths,
  components,
} from '@ds-hub/shared-types/typescript/api/schema';

// GET /components - 컴포넌트 스키마 조회
export type ComponentSchemaResponse =
  paths['/components']['get']['responses']['200']['content']['application/json'];

// POST /components/reload - 컴포넌트 스키마 리로드
export type ComponentReloadResponse =
  paths['/components/reload']['post']['responses']['200']['content']['application/json'];

// ReloadResponse 스키마
export type ReloadResponseSchema = components['schemas']['ReloadResponse'];
