import type { ColumnSize, GridType, GridTypeDefinition } from './types';

// Grid Type 정의 (가이드 문서 Section 5 기반)
export const GRID_TYPE_DEFINITIONS: Record<GridType, GridTypeDefinition> = {
  A: { type: 'A', columns: [12], label: 'col-12', description: '단일 영역형' },
  B: { type: 'B', columns: [6, 6], label: 'col-6 + col-6', description: '균등 2열형' },
  C: { type: 'C', columns: [3, 9], label: 'col-3 + col-9', description: '목록+상세형' },
  'C-2': { type: 'C-2', columns: [9, 3], label: 'col-9 + col-3', description: '목록+상세형 (역순)' },
  D: { type: 'D', columns: [4, 8], label: 'col-4 + col-8', description: '필터 확장형' },
  'D-2': { type: 'D-2', columns: [8, 4], label: 'col-8 + col-4', description: '필터 확장형 (역순)' },
  E: { type: 'E', columns: [4, 4, 4], label: 'col-4 x 3', description: '균등 3열형' },
  F: { type: 'F', columns: [2, 8, 2], label: 'col-2 + col-8 + col-2', description: '중앙 집중형' },
  G: { type: 'G', columns: [2, 2, 8], label: 'col-2 + col-2 + col-8', description: '탐색 2단계형' },
  H: { type: 'H', columns: [3, 3, 3, 3], label: 'col-3 x 4', description: '균등 4열형' },
};

// col-span 정적 매핑 (Tailwind purge 대응)
export const COL_SPAN_CLASS: Record<ColumnSize, string> = {
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  6: 'col-span-6',
  8: 'col-span-8',
  9: 'col-span-9',
  12: 'col-span-12',
};
