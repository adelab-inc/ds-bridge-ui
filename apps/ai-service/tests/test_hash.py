"""콘텐츠 해시(변경 탐지용) 테스트.

- content_hash: SHA-256 결정성
- 내부 모델 computed_field: DescriptionResponse.description_hash / MessageDocument.code_hash
- 외부 모델 computed_field + 신규 /code/hash/{crid} 엔드포인트
- 내부·외부 동일 본문 → 동일 해시 (compute-on-read 일관성)
"""
import hashlib

import pytest
from fastapi.testclient import TestClient

from app.api import external as ext
from app.api.external import external_app
from app.core.auth import verify_external_api_key
from app.core.hashing import content_hash
from app.schemas.chat import MessageDocument
from app.schemas.description import DescriptionResponse
from app.schemas.external import ExternalCodeResponse, ExternalDescriptionResponse

CRID = "5169a302-629f-4759-8568-c0a7849f4439"


# ── 헬퍼 ──────────────────────────────────────────────────────

def test_content_hash_is_sha256_and_deterministic():
    assert content_hash("abc") == hashlib.sha256(b"abc").hexdigest()
    assert content_hash("abc") == content_hash("abc")
    assert content_hash("a") != content_hash("b")
    assert len(content_hash("x")) == 64


# ── 내부 모델 ─────────────────────────────────────────────────

def test_description_hash_uses_edited_content_first():
    d = DescriptionResponse(
        id="x", room_id="r", content="ORIG", version=1, reason="", edited_content="EDIT", created_at=0,
    )
    assert d.model_dump()["description_hash"] == content_hash("EDIT")

    d2 = DescriptionResponse(
        id="x", room_id="r", content="ORIG", version=1, reason="", edited_content=None, created_at=0,
    )
    assert d2.model_dump()["description_hash"] == content_hash("ORIG")


def test_message_code_hash_present_only_with_code():
    m = MessageDocument(
        id="m", room_id="r", content="const A=1;", path="a.tsx",
        question_created_at=0, answer_created_at=0, status="DONE",
    )
    assert m.model_dump()["code_hash"] == content_hash("const A=1;")

    m_text = MessageDocument(
        id="m2", room_id="r", content="", path="",
        question_created_at=0, answer_created_at=0, status="DONE",
    )
    assert m_text.model_dump()["code_hash"] is None


# ── 외부 모델 + 내부·외부 일관성 ──────────────────────────────

def test_external_models_compute_hash():
    c = ExternalCodeResponse(crid=CRID, code="X", path="p.tsx", generated_at=0)
    assert c.model_dump()["code_hash"] == content_hash("X")
    d = ExternalDescriptionResponse(crid=CRID, content="D", version=1, is_edited=False, updated_at=0)
    assert d.model_dump()["description_hash"] == content_hash("D")


def test_internal_external_hash_match():
    """같은 본문 → 내부·외부 해시 동일 (UI 뱃지 == agent 폴링값)."""
    internal = MessageDocument(
        id="m", room_id="r", content="SAME CODE", path="a.tsx",
        question_created_at=0, answer_created_at=0, status="DONE",
    )
    external = ExternalCodeResponse(crid=CRID, code="SAME CODE", path="a.tsx", generated_at=0)
    assert internal.model_dump()["code_hash"] == external.model_dump()["code_hash"]


# ── 외부 엔드포인트 ───────────────────────────────────────────

@pytest.fixture
def ext_client():
    external_app.dependency_overrides[verify_external_api_key] = lambda: True
    yield TestClient(external_app)
    external_app.dependency_overrides.clear()


def test_code_hash_endpoint_is_lightweight(ext_client, monkeypatch):
    async def fake(crid):
        return {"content": "const A=1;", "path": "a.tsx", "answer_created_at": 123}

    monkeypatch.setattr(ext, "get_latest_code_message", fake)
    r = ext_client.get(f"/code/hash/{CRID}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["crid"] == CRID
    assert body["code_hash"] == content_hash("const A=1;")
    assert body["generated_at"] == 123
    assert "code" not in body  # 경량: 본문 미포함


def test_code_hash_endpoint_404(ext_client, monkeypatch):
    async def fake(crid):
        return None

    monkeypatch.setattr(ext, "get_latest_code_message", fake)
    r = ext_client.get(f"/code/hash/{CRID}")
    assert r.status_code == 404


def test_existing_code_endpoint_includes_hash(ext_client, monkeypatch):
    async def fake(crid):
        return {"content": "Y", "path": "p.tsx", "answer_created_at": 1}

    monkeypatch.setattr(ext, "get_latest_code_message", fake)
    r = ext_client.get(f"/code/{CRID}")
    assert r.status_code == 200, r.text
    assert r.json()["code_hash"] == content_hash("Y")


def test_existing_description_endpoint_includes_hash(ext_client, monkeypatch):
    async def fake(crid):
        return {"content": "DESC", "edited_content": None, "version": 2, "created_at": 9}

    monkeypatch.setattr(ext, "get_latest_description", fake)
    r = ext_client.get(f"/description/{CRID}")
    assert r.status_code == 200, r.text
    assert r.json()["description_hash"] == content_hash("DESC")


# ── 저장 컬럼(DB 생성 컬럼) 값이 있으면 재계산 없이 그대로 사용 ──

def test_message_uses_stored_code_hash_when_present():
    m = MessageDocument(
        id="m", room_id="r", content="anything", path="a.tsx",
        question_created_at=0, answer_created_at=0, status="DONE",
        code_hash="STORED_FROM_DB",
    )
    assert m.model_dump()["code_hash"] == "STORED_FROM_DB"  # content로 재계산 안 함


def test_description_uses_stored_hash_when_present():
    d = DescriptionResponse(
        id="x", room_id="r", content="ORIG", version=1, reason="",
        edited_content="EDIT", created_at=0, description_hash="STORED_FROM_DB",
    )
    assert d.model_dump()["description_hash"] == "STORED_FROM_DB"


def test_code_hash_endpoint_uses_stored_value(ext_client, monkeypatch):
    async def fake(crid):
        return {"content": "const A=1;", "code_hash": "STORED_FROM_DB", "answer_created_at": 1}

    monkeypatch.setattr(ext, "get_latest_code_message", fake)
    r = ext_client.get(f"/code/hash/{CRID}")
    assert r.status_code == 200, r.text
    assert r.json()["code_hash"] == "STORED_FROM_DB"  # DB 컬럼 우선


# ── git 약식(short) 해시: 풀의 앞 7자, 표시용 ──────────────────

def test_short_hash_is_first_7_of_full():
    full = content_hash("hello")
    m = MessageDocument(
        id="m", room_id="r", content="hello", path="a.tsx",
        question_created_at=0, answer_created_at=0, status="DONE",
    )
    body = m.model_dump()
    assert body["code_hash"] == full  # 풀은 그대로
    assert body["code_hash_short"] == full[:7]  # 약식은 앞 7자
    assert len(body["code_hash_short"]) == 7


def test_short_hash_null_when_no_hash():
    m = MessageDocument(
        id="m", room_id="r", content="", path="",
        question_created_at=0, answer_created_at=0, status="DONE",
    )
    assert m.model_dump()["code_hash_short"] is None


def test_external_responses_expose_short(ext_client, monkeypatch):
    async def fake_code(crid):
        return {"content": "Z", "path": "p.tsx", "answer_created_at": 1}

    monkeypatch.setattr(ext, "get_latest_code_message", fake_code)
    body = ext_client.get(f"/code/{CRID}").json()
    full = content_hash("Z")
    assert body["code_hash"] == full and body["code_hash_short"] == full[:7]

    hbody = ext_client.get(f"/code/hash/{CRID}").json()
    assert hbody["code_hash_short"] == full[:7]


def test_description_hash_endpoint(ext_client, monkeypatch):
    async def fake(crid):
        return {"content": "DESC", "edited_content": None, "version": 2, "created_at": 9}

    monkeypatch.setattr(ext, "get_latest_description", fake)
    r = ext_client.get(f"/description/hash/{CRID}")
    assert r.status_code == 200, r.text
    body = r.json()
    full = content_hash("DESC")
    assert body["description_hash"] == full
    assert body["description_hash_short"] == full[:7]
    assert body["version"] == 2
    assert "content" not in body  # 경량: 본문 미포함


def test_description_hash_endpoint_prefers_edited(ext_client, monkeypatch):
    async def fake(crid):
        return {"content": "ORIG", "edited_content": "EDIT", "version": 3, "created_at": 1}

    monkeypatch.setattr(ext, "get_latest_description", fake)
    body = ext_client.get(f"/description/hash/{CRID}").json()
    assert body["description_hash"] == content_hash("EDIT")  # 편집본 우선


def test_description_hash_endpoint_404(ext_client, monkeypatch):
    async def fake(crid):
        return None

    monkeypatch.setattr(ext, "get_latest_description", fake)
    assert ext_client.get(f"/description/hash/{CRID}").status_code == 404


def test_examples_include_short_fields():
    """스웨거 Example Value(json_schema_extra)에도 *_short 가 들어가야 함."""
    from app.schemas.external import (
        ExternalCodeHashResponse,
        ExternalCodeResponse,
        ExternalDescriptionHashResponse,
        ExternalDescriptionResponse,
    )
    cases = [
        (ExternalCodeResponse, "code_hash_short"),
        (ExternalCodeHashResponse, "code_hash_short"),
        (ExternalDescriptionResponse, "description_hash_short"),
        (ExternalDescriptionHashResponse, "description_hash_short"),
    ]
    for model, key in cases:
        example = model.model_json_schema().get("example", {})
        assert key in example, f"{model.__name__} example에 {key} 누락"
