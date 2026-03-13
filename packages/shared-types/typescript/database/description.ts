/**
 * Description 관련 타입 정의
 *
 * descriptions 테이블 기반 타입 (수동 관리)
 */

/** 디스크립션 생성 사유 */
export type DescriptionReason =
  | 'initial'
  | 'regenerated_with_edits'
  | 'regenerated';

/** 변경 요약 태그 */
export interface ChangeTag {
  type: 'add' | 'edit' | 'context';
  label: string;
}

/** descriptions 테이블 전체 레코드 */
export interface Description {
  id: string;
  room_id: string;
  content: string;
  version: number;
  reason: DescriptionReason;
  change_tags: ChangeTag[];
  edited_content: string | null;
  base_message_id: string | null;
  created_by: string | null;
  created_at: number;
}

/** 버전 목록 조회용 요약 타입 */
export interface DescriptionVersionSummary {
  id: string;
  version: number;
  reason: DescriptionReason;
  change_tags: ChangeTag[];
  created_at: number;
}

/** 편집 이력 (재추출 시 AI 컨텍스트 전달용) */
export interface EditHistory {
  original_content: string;
  edited_content: string;
  base_version: number;
}
