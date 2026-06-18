"""get_current_user_id (Supabase JWT 검증 의존성) 테스트."""

import jwt
import pytest
from fastapi import HTTPException

from app.core import auth as auth_module


class _Settings:
    def __init__(self, secret: str):
        self.supabase_jwt_secret = secret


def _set_secret(monkeypatch, secret: str):
    monkeypatch.setattr(auth_module, "get_settings", lambda: _Settings(secret))


def _token(secret: str, *, sub="user-123", aud="authenticated"):
    payload = {"sub": sub, "aud": aud}
    return jwt.encode(payload, secret, algorithm="HS256")


async def test_valid_token_returns_uid(monkeypatch):
    _set_secret(monkeypatch, "test-secret")
    uid = await auth_module.get_current_user_id(f"Bearer {_token('test-secret')}")
    assert uid == "user-123"


async def test_invalid_signature_raises_401(monkeypatch):
    _set_secret(monkeypatch, "test-secret")
    bad = _token("WRONG-SECRET")  # 다른 키로 서명 → 검증 실패
    with pytest.raises(HTTPException) as e:
        await auth_module.get_current_user_id(f"Bearer {bad}")
    assert e.value.status_code == 401


async def test_wrong_audience_raises_401(monkeypatch):
    _set_secret(monkeypatch, "test-secret")
    tok = _token("test-secret", aud="not-authenticated")
    with pytest.raises(HTTPException) as e:
        await auth_module.get_current_user_id(f"Bearer {tok}")
    assert e.value.status_code == 401


async def test_missing_or_malformed_header_raises_401(monkeypatch):
    _set_secret(monkeypatch, "test-secret")
    for header in (None, "", "token-without-bearer"):
        with pytest.raises(HTTPException) as e:
            await auth_module.get_current_user_id(header)
        assert e.value.status_code == 401


async def test_dev_mode_no_secret_returns_none(monkeypatch):
    """시크릿 미설정 → 검증 비활성. 토큰 유무와 무관하게 None (소유권 검증 스킵)."""
    _set_secret(monkeypatch, "")
    assert await auth_module.get_current_user_id(None) is None
    assert await auth_module.get_current_user_id("Bearer anything") is None
