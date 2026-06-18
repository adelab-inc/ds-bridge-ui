"""콘텐츠 해시 유틸 — 코드/디스크립션 변경 탐지용.

DB STORED 생성 컬럼(마이그레이션 004)이 본문에서 SHA-256 을 자동 계산/저장한다.
본 모듈의 content_hash 는 그와 동일한 값을 내는 폴백/검증용(마이그레이션 적용 전 deploy gap).

해시 사용 규약 (git 방식):
- 풀 해시(64자)  → 식별·비교(변경 탐지)에 사용. 충돌 사실상 0.
- 약식 해시(7자) → 사람이 보는 표시용(뱃지). short_hash() 로 풀의 앞부분만 자른 것.
"""
import hashlib

# git core.abbrev 기본값과 동일한 약식 길이. 표시용이며 비교/식별엔 풀 해시를 쓴다.
SHORT_HASH_LEN = 7


def content_hash(text: str) -> str:
    """본문의 SHA-256 해시(hex, 64자). 같은 본문 → 같은 해시(결정적), UTF-8 기준."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def short_hash(full: str | None) -> str | None:
    """풀 해시의 git 약식 형태(앞 SHORT_HASH_LEN 자). 표시용. None → None."""
    return full[:SHORT_HASH_LEN] if full else None
