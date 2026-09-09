"""External API — 대화 내역 조회 (`GET /external/messages/{crid}`).

핸드오프: external-api-messages-endpoint-handoff-2026-09-09.md
- 코드 본문(`content`)은 응답에서 제외하고 `has_code`/`code_hash` 로 대체
- 메시지 0건이지만 룸이 존재하면 404 가 아니라 빈 배열 + total_count 0
- 룸 자체가 없으면 404 (오타 crid 를 잡아주기 위함)
"""

import pytest
from fastapi.testclient import TestClient

from app.api import external as external_module
from app.core.auth import verify_external_api_key
from app.core.hashing import content_hash
from app.main import app

CRID = "48e81932-00fb-43d9-bb7f-88b126400203"

CODE = "export const A = () => null; // 코드 본문"

_MESSAGES = [
    {
        "id": "m1",
        "question": "페이지 만들어줘",
        "text": "생성했습니다.",
        "content": CODE,
        "path": "src/pages/NewContractSpecification.tsx",
        "status": "DONE",
        "question_created_at": 500,
        "answer_created_at": 900,
        "code_hash": "storedhash1",
        "image_urls": [],
    },
    {
        "id": "m2",
        "question": "헤더명이 잘리지 않게 표시해",
        "text": None,
        "content": "",
        "path": "",
        "status": "ERROR",
        "question_created_at": 1000,
        "answer_created_at": 2000,
        "code_hash": None,
        "image_urls": ["https://x/1.png"],
    },
]


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


def _patch(monkeypatch, *, messages=None, total=2, next_cursor=None, has_more=False, room=object()):
    calls: list[dict] = []

    async def fake_room(room_id):
        return None if room is None else {"id": room_id, "storybook_url": "t"}

    async def fake_paginated(room_id, limit=20, cursor=None, order="desc"):
        calls.append({"room_id": room_id, "limit": limit, "cursor": cursor, "order": order})
        return {
            "messages": _MESSAGES if messages is None else messages,
            "next_cursor": next_cursor,
            "has_more": has_more,
            "total_count": total,
        }

    monkeypatch.setattr(external_module, "get_chat_room", fake_room)
    monkeypatch.setattr(external_module, "get_messages_paginated", fake_paginated)
    return calls


def test_field_mapping_excludes_code_body(monkeypatch, client):
    """핸드오프 3-2 필드 매핑 — 코드 본문은 나가지 않고 has_code 로 알린다."""
    _patch(monkeypatch)
    res = client.get(f"/external/messages/{CRID}")

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["crid"] == CRID
    assert body["total_count"] == 2

    first, second = body["messages"]
    assert first["question"] == "페이지 만들어줘"
    assert first["answer"] == "생성했습니다."
    assert "code" not in first, "코드 본문 필드는 응답에 없어야 한다"
    assert first["has_code"] is True
    assert first["code_hash"] == "storedhash1"
    assert first["code_path"] == "src/pages/NewContractSpecification.tsx"
    assert first["status"] == "DONE"
    assert first["question_created_at"] == 500
    assert first["answer_created_at"] == 900

    assert second["has_code"] is False, "content 가 비면 has_code=false"
    assert second["answer"] is None
    assert second["status"] == "ERROR"


def test_code_hash_is_computed_when_column_empty(monkeypatch, client):
    """code_hash 컬럼이 비면 content 로 계산한다 (ExternalCodeResponse 와 동일 규칙)."""
    rows = [{**_MESSAGES[0], "code_hash": None}]
    _patch(monkeypatch, messages=rows, total=1)
    res = client.get(f"/external/messages/{CRID}")

    assert res.status_code == 200, res.text
    assert res.json()["messages"][0]["code_hash"] == content_hash(CODE)


def test_empty_room_returns_empty_list_not_404(monkeypatch, client):
    """메시지가 0건이어도 룸이 있으면 200 + 빈 배열."""
    _patch(monkeypatch, messages=[], total=0)
    res = client.get(f"/external/messages/{CRID}")

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["messages"] == []
    assert body["total_count"] == 0
    assert body["has_more"] is False


def test_404_when_room_does_not_exist(monkeypatch, client):
    """오타 crid 를 잡아주기 위해 룸 존재를 먼저 확인한다."""
    _patch(monkeypatch, room=None)
    res = client.get(f"/external/messages/{CRID}")

    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_pagination_params_are_forwarded_with_handoff_defaults(monkeypatch, client):
    """기본값은 limit=50 / order=asc (핸드오프 3-1)."""
    calls = _patch(monkeypatch, next_cursor=900, has_more=True)

    res = client.get(f"/external/messages/{CRID}")
    assert res.status_code == 200, res.text
    assert calls[0] == {"room_id": CRID, "limit": 50, "cursor": None, "order": "asc"}
    assert res.json()["next_cursor"] == 900
    assert res.json()["has_more"] is True

    client.get(f"/external/messages/{CRID}", params={"limit": 100, "cursor": 1500, "order": "desc"})
    assert calls[1] == {"room_id": CRID, "limit": 100, "cursor": 1500, "order": "desc"}


@pytest.mark.parametrize(
    "params,path",
    [
        ({"limit": 0}, CRID),
        ({"limit": 101}, CRID),
        ({"order": "foo"}, CRID),
        ({}, "not-a-uuid"),
    ],
)
def test_422_on_invalid_input(monkeypatch, client, params, path):
    _patch(monkeypatch)
    res = client.get(f"/external/messages/{path}", params=params)

    assert res.status_code == 422
    assert isinstance(res.json()["detail"], str), "기존 규약대로 detail 은 문자열"


def test_include_code_option_returns_body(monkeypatch, client):
    """코드 본문이 꼭 필요한 소비자를 위한 옵션 (핸드오프 범위 밖 추가 제공)."""
    _patch(monkeypatch)
    res = client.get(f"/external/messages/{CRID}", params={"include_code": "true"})

    assert res.status_code == 200, res.text
    assert res.json()["messages"][0]["code"] == CODE


def test_requires_api_key(monkeypatch):
    _patch(monkeypatch)
    res = TestClient(app).get(f"/external/messages/{CRID}")

    assert res.status_code in (401, 403), res.text
