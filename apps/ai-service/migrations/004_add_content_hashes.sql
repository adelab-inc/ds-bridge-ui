-- 코드/디스크립션 콘텐츠 해시 (저장형) — Postgres STORED generated column
--
-- 본문이 바뀌면 DB가 해시를 자동 재계산해 컬럼에 저장한다.
-- → 앱 쓰기경로 코드/백필 스크립트 불필요, 본문↔해시 불일치(stale) 원천 차단.
--
-- [중요] 생성 컬럼 식에는 IMMUTABLE 함수만 허용된다. 내장 convert_to() 는 STABLE 이라
--        직접 쓰면 "42P17: generation expression is not immutable" 에러가 난다.
--        → UTF-8 기준 SHA-256 hex 를 내는 IMMUTABLE 래퍼 함수를 만들어 사용한다.
--        단일 DB 의 인코딩은 UTF-8 로 고정이므로 convert_to(t,'UTF8') 는 사실상 t 만의
--        순수함수 → IMMUTABLE 표시 안전. 확장(pgcrypto) 불필요.
--
-- 값은 Python `hashlib.sha256(text.encode("utf-8")).hexdigest()` 와 동일한 64자 hex.
--
-- 주의: STORED 생성 컬럼 추가는 테이블 재작성(ACCESS EXCLUSIVE 락)을 유발하며,
--       추가와 동시에 기존 row 가 모두 채워진다(자동 백필).
-- 주의: 생성 컬럼은 직접 INSERT/UPDATE 불가 → 복구(restore) 시 제외 필요
--       (app/services/supabase_db.py 의 _strip_generated_columns).

-- UTF-8 SHA-256 hex 래퍼 (IMMUTABLE)
CREATE OR REPLACE FUNCTION sha256_hex(t text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  AS $$ SELECT encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;

-- 1) 코드 메시지 해시: content(React 코드)의 SHA-256. 코드가 없으면 NULL.
ALTER TABLE chat_messages
  ADD COLUMN code_hash TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN coalesce(content, '') <> ''
      THEN sha256_hex(content)
      ELSE NULL
    END
  ) STORED;

-- 2) 디스크립션 해시: 표시 본문(편집본 우선)의 SHA-256.
--    편집(edited_content)이 갱신되면 자동으로 해시도 재계산된다.
ALTER TABLE descriptions
  ADD COLUMN description_hash TEXT
  GENERATED ALWAYS AS (
    sha256_hex(coalesce(edited_content, content))
  ) STORED;

-- (선택) 해시로 조회/조인할 일이 생기면 인덱스 추가
-- CREATE INDEX idx_chat_messages_code_hash ON chat_messages(code_hash);
-- CREATE INDEX idx_descriptions_description_hash ON descriptions(description_hash);
