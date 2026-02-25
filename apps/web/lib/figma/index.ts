/**
 * Figma Extraction Module
 *
 * Figma 디자인 URL에서 layout-schema.json을 추출하는 통합 모듈
 */

export { parseFigmaUrl } from './parse-url';
export { fetchFigmaNodes, FigmaApiError } from './api';
export {
  extractLayoutSchema,
  createCleanSchema,
  createCompactSchema,
} from './extract-layout';
