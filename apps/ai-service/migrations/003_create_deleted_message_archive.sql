-- 삭제된 개별 메시지 아카이브 (복구 + 감사용)
-- 메시지를 hard delete 하기 직전에 메시지 행 스냅샷을 JSONB로 보관한다.
-- (방 단위 삭제는 002의 deleted_room_archive가 담당, 이건 개별 메시지 삭제용)

CREATE TABLE deleted_message_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,               -- FK 아님: 원본이 삭제되므로 참조 X
  room_id UUID,                           -- 메시지가 속했던 방 (참조용)
  deleted_by TEXT,                        -- 삭제 요청 사용자 ID (없을 수 있음)
  deleted_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  payload JSONB NOT NULL                  -- 메시지 행 전체
);

CREATE INDEX idx_deleted_message_archive_message ON deleted_message_archive(message_id);
CREATE INDEX idx_deleted_message_archive_room ON deleted_message_archive(room_id);

-- 복구: payload 를 chat_messages 로 재삽입 (방이 살아있어야 함 — FK).
-- 보존: deleted_room_archive 와 동일한 retention 정책 적용 권장.
