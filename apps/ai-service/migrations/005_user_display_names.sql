-- 005_user_display_names.sql
-- 운영자가 통제하는 멤버 표시명 매핑.
-- 배경: auth.users.user_metadata 의 이름은 OAuth(구글) 로그인 시 provider 가 재동기화하여
--       운영자가 수동 설정한 값이 다음 로그인에 덮어써진다. 이를 회피하기 위해 별도 테이블에
--       표시명을 저장하고 GET /users 에서 오버레이한다(매핑 우선, 없으면 user_metadata.name 폴백).
--
-- 키: user_id(UUID) — 이메일은 한 사람이 여러 개(=여러 계정)일 수 있고 변경될 수 있어 불안정.
-- 접근: 서비스롤(BE)만. RLS 활성 + 정책 없음 → 서비스롤만 통과(클라 직접 접근 차단).
-- set: 운영자가 SQL editor 에서 수동 upsert (아래 예시).

create table if not exists public.user_display_names (
    user_id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null,
    updated_at timestamptz not null default now()
);

alter table public.user_display_names enable row level security;

-- 수동 설정 예시 (운영자):
-- insert into public.user_display_names (user_id, display_name)
-- values ('7166435a-6f5f-428a-8114-5e41259dbd56', '박재민')
-- on conflict (user_id) do update
--   set display_name = excluded.display_name, updated_at = now();
