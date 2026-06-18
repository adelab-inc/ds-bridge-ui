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

/** descriptions 테이블 전체 레코드 */
export interface Description {
  id: string;
  room_id: string;
  content: string;
  version: number;
  reason: DescriptionReason;
  edited_content: string | null;
  base_message_id: string | null;
  created_by: string | null;
  created_at: number;
  /** SHA-256 풀 해시(64자). 변경 탐지/비교용 (STORED 컬럼, migration 004) */
  description_hash?: string | null;
  /** description_hash 의 git 약식(앞 7자). 화면 뱃지 표시 전용 (REST 응답 computed) */
  description_hash_short?: string | null;
}

/** 버전 목록 조회용 요약 타입 */
export interface DescriptionVersionSummary {
  id: string;
  version: number;
  reason: DescriptionReason;
  created_at: number;
  /** description_hash 의 git 약식(앞 7자). BE VersionSummaryResponse 가 내려줄 때만 존재 */
  description_hash_short?: string | null;
}

/** 편집 이력 (재추출 시 AI 컨텍스트 전달용) */
export interface EditHistory {
  original_content: string;
  edited_content: string;
  base_version: number;
}
