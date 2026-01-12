/**
 * Health API 타입 정의
 *
 * OpenAPI에서 자동 생성된 타입 사용
 */

import type { paths } from '@ds-hub/shared-types/typescript/api/schema';

// GET /health - 서버 상태 확인
export type HealthResponse =
  paths['/health']['get']['responses']['200']['content']['application/json'];
