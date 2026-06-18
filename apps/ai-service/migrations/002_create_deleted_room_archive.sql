-- 삭제된 채팅방 아카이브 (복구 + 감사용)
-- 방을 hard delete 하기 직전에 방 + 메시지 + 디스크립션 스냅샷을 JSONB로 보관한다.
-- 읽기 경로(현행 쿼리)는 건드리지 않으므로 기존 동작에 영향 없음.

CREATE TABLE deleted_room_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,                  -- FK 아님: 원본 방이 삭제되므로 참조 X
  deleted_by TEXT,                        -- 삭제 요청 사용자 ID (없을 수 있음)
  deleted_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  payload JSONB NOT NULL                  -- { room, messages[], descriptions[] }
);

CREATE INDEX idx_deleted_room_archive_room ON deleted_room_archive(room_id);
CREATE INDEX idx_deleted_room_archive_deleted_at ON deleted_room_archive(deleted_at DESC);

-- 복구: payload->'room' / 'messages' / 'descriptions' 를 원본 테이블로 재삽입.
-- 보존: 운영 정책에 따라 deleted_at 기준으로 오래된 행을 주기적으로 purge.
