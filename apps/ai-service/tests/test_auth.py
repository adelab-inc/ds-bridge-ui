"""get_current_user_id (Supabase JWT 검증, JWKS/ES256) 테스트.

이 프로젝트의 Supabase는 비대칭 ES256(P-256) 서명을 쓰므로, 공개키로 검증한다.
테스트는 EC 키쌍을 직접 만들어 토큰을 서명하고, JWKS 클라이언트를 가짜로 주입한다.
"""

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException

from app.core import auth as auth_module

# 테스트용 EC P-256 키쌍 (ES256). _PRIV2 는 위조(다른 키 서명) 시뮬레이션용.
_PRIV = ec.generate_private_key(ec.SECP256R1())
_PRIV2 = ec.generate_private_key(ec.SECP256R1())


class _FakeKey:
    def __init__(self, public_key):
        self.key = public_key


class _FakeJWKS:
    def __init__(self, public_key):
        self._k = public_key

    def get_signing_key_from_jwt(self, _token):
        return _FakeKey(self._k)


class _Settings:
    def __init__(self, enabled: bool, url: str = "https://x.supabase.co"):
        self.jwt_verify_enabled = enabled
        self.supabase_url = url


def _setup(monkeypatch, *, enabled=True, verify_key=None):
    monkeypatch.setattr(auth_module, "get_settings", lambda: _Settings(enabled))
    if verify_key is not None:
        monkeypatch.setattr(auth_module, "_get_jwks_client", lambda: _FakeJWKS(verify_key))


def _token(priv, *, sub="user-123", aud="authenticated"):
    return jwt.encode({"sub": sub, "aud": aud}, priv, algorithm="ES256")


async def test_valid_token_returns_uid(monkeypatch):
    _setup(monkeypatch, verify_key=_PRIV.public_key())
    assert await auth_module.get_current_user_id(f"Bearer {_token(_PRIV)}") == "user-123"


async def test_invalid_signature_raises_401(monkeypatch):
    # _PRIV2 로 서명했는데 검증 공개키는 _PRIV → 불일치
    _setup(monkeypatch, verify_key=_PRIV.public_key())
    with pytest.raises(HTTPException) as e:
        await auth_module.get_current_user_id(f"Bearer {_token(_PRIV2)}")
    assert e.value.status_code == 401


async def test_wrong_audience_raises_401(monkeypatch):
    _setup(monkeypatch, verify_key=_PRIV.public_key())
    with pytest.raises(HTTPException) as e:
        await auth_module.get_current_user_id(f"Bearer {_token(_PRIV, aud='nope')}")
    assert e.value.status_code == 401


async def test_missing_or_malformed_header_raises_401(monkeypatch):
    _setup(monkeypatch, verify_key=_PRIV.public_key())
    for header in (None, "", "no-bearer-prefix"):
        with pytest.raises(HTTPException) as e:
            await auth_module.get_current_user_id(header)
        assert e.value.status_code == 401


async def test_jwks_fetch_failure_is_fail_closed(monkeypatch):
    """JWKS 조회/검증 중 예외 → 보안상 401(fail-closed)."""
    monkeypatch.setattr(auth_module, "get_settings", lambda: _Settings(True))

    class _Boom:
        def get_signing_key_from_jwt(self, _t):
            raise RuntimeError("network down")

    monkeypatch.setattr(auth_module, "_get_jwks_client", lambda: _Boom())
    with pytest.raises(HTTPException) as e:
        await auth_module.get_current_user_id(f"Bearer {_token(_PRIV)}")
    assert e.value.status_code == 401


async def test_disabled_returns_none(monkeypatch):
    """마스터 스위치 OFF → 검증 비활성. 토큰 유무 무관 None (소유권 검증 스킵)."""
    _setup(monkeypatch, enabled=False)
    assert await auth_module.get_current_user_id(None) is None
    assert await auth_module.get_current_user_id(f"Bearer {_token(_PRIV)}") is None
