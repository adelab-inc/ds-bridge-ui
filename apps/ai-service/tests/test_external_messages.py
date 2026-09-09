"""External API — 대화 내역 조회 (`GET /external/messages/{crid}`).

배경: 외부에서 방(crid)의 대화 전체를 보려면 웹 UI 스크롤에 의존해야 했다
(초기 로드 20건, 그 이전은 상단 스크롤 필요). 조사·연동 목적의 조회를 API 로 제공한다.

코드 본문은 메시지당 20KB 를 넘어 기본 제외한다 — 30건이면 700KB 가 된다.
"""

import pytest
from fastapi.testclient import TestClient

from app.api import external as external_module
from app.core.auth import verify_external_api_key
from app.main import app


@pytest.fixture
def client():
    """외부 API 키 검증을 우회한 클라이언트 (sub-app 에 오버라이드)."""

    async def skip_external_auth() -> str:
        return "test-external-key"

    external_module.external_app.dependency_overrides[verify_external_api_key] = (
        skip_external_auth
    )
    yield TestClient(app)
    external_module.external_app.dependency_overrides.clear()

CRID = "48e81932-00fb-43d9-bb7f-88b126400203"

_MESSAGES = [
    {
        "id": "m2",
        "question": "헤더명이 잘리지 않게 표시해",
        "text": "headerHeight 를 조정했습니다.",
        "content": "export const A = () => null; // 코드 본문",
        "path": "src/pages/A.tsx",
        "status": "DONE",
        "question_created_at": 1000,
        "answer_created_at": 2000,
        "code_hash": "hash2",
        "image_urls": [],
    },
    {
        "id": "m1",
        "question": "페이지 만들어줘",
        "text": "생성했습니다.",
        "content": "export const A = () => null;",
        "path": "src/pages/A.tsx",
        "status": "DONE",
        "question_created_at": 500,
        "answer_created_at": 900,
        "code_hash": "hash1",
        "image_urls": [],
    },
]


def _patch_service(monkeypatch, messages=None, total=2, next_cursor=None, has_more=False):
    calls: list[dict] = []

    async def fake_paginated(room_id, limit=20, cursor=None, order="desc"):
        calls.append({"room_id": room_id, "limit": limit, "cursor": cursor, "order": order})
        return {
            "messages": _MESSAGES if messages is None else messages,
            "next_cursor": next_cursor,
            "has_more": has_more,
            "total_count": total,
        }

    monkeypatch.setattr(external_module, "get_messages_paginated", fake_paginated)
    return calls


def test_messages_excludes_code_body_by_default(monkeypatch, client):
    """기본 응답에는 코드 본문이 없어야 한다 (payload 폭증 방지)."""
    _patch_service(monkeypatch)
    res = client.get(f"/external/messages/{CRID}")

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["crid"] == CRID
    assert body["total_count"] == 2
    assert len(body["messages"]) == 2
    first = body["messages"][0]
    assert first["question"] == "헤더명이 잘리지 않게 표시해"
    assert first["answer"] == "headerHeight 를 조정했습니다."
    assert first["code"] is None, "기본에는 코드 본문을 싣지 않는다"
    assert first["code_hash"] == "hash2", "변경 탐지용 해시는 제공한다"
    assert first["path"] == "src/pages/A.tsx"


def test_messages_includes_code_when_requested(monkeypatch, client):
    _patch_service(monkeypatch)
    res = client.get(f"/external/messages/{CRID}", params={"include_code": "true"})

    assert res.status_code == 200, res.text
    assert res.json()["messages"][0]["code"] == "export const A = () => null; // 코드 본문"


def test_messages_forwards_pagination_params(monkeypatch, client):
    calls = _patch_service(monkeypatch, next_cursor=900, has_more=True)
    res = client.get(
        f"/external/messages/{CRID}", params={"limit": 100, "cursor": 1500, "order": "asc"}
    )

    assert res.status_code == 200, res.text
    assert calls[0] == {"room_id": CRID, "limit": 100, "cursor": 1500, "order": "asc"}
    body = res.json()
    assert body["next_cursor"] == 900
    assert body["has_more"] is True


def test_messages_404_when_room_has_no_messages(monkeypatch, client):
    _patch_service(monkeypatch, messages=[], total=0)
    res = client.get(f"/external/messages/{CRID}")

    assert res.status_code == 404


def test_messages_rejects_malformed_crid(monkeypatch, client):
    _patch_service(monkeypatch)
    res = client.get("/external/messages/not-a-uuid")

    assert res.status_code == 422


def test_messages_requires_api_key(monkeypatch):
    """X-API-Key 누락 시 데이터가 새지 않아야 한다."""
    _patch_service(monkeypatch)
    res = TestClient(app).get(f"/external/messages/{CRID}")

    assert res.status_code in (401, 403), res.text
