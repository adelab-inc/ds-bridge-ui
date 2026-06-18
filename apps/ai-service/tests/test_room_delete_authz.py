"""채팅방 삭제 인가/감사 테스트.

- 소유자가 아니면(user_id 불일치) 403 → 삭제 안 됨
- 소유자면 200 + delete_chat_room에 deleted_by 전달
- user_id 없으면(하위호환) 기존처럼 삭제 진행
"""

from app.api import rooms as rooms_module
from app.api.rooms import get_room_or_404
from app.main import app


def _override_room(owner: str):
    app.dependency_overrides[get_room_or_404] = lambda: {"id": "r1", "user_id": owner}


def test_delete_forbidden_when_not_owner(client, monkeypatch):
    _override_room("owner-A")
    called = {}

    async def fake_delete(room_id, deleted_by=None):
        called["hit"] = True
        return True

    monkeypatch.setattr(rooms_module, "delete_chat_room", fake_delete)
    try:
        resp = client.delete("/rooms/r1", params={"user_id": "other-B"})
        assert resp.status_code == 403, resp.text
        assert "hit" not in called  # 삭제 호출 자체가 안 됨
    finally:
        app.dependency_overrides.pop(get_room_or_404, None)


def test_delete_ok_and_logs_deleter_when_owner(client, monkeypatch):
    _override_room("owner-A")
    called = {}

    async def fake_delete(room_id, deleted_by=None):
        called["args"] = (room_id, deleted_by)
        return True

    monkeypatch.setattr(rooms_module, "delete_chat_room", fake_delete)
    try:
        resp = client.delete("/rooms/r1", params={"user_id": "owner-A"})
        assert resp.status_code == 200, resp.text
        assert called["args"] == ("r1", "owner-A")  # 삭제자 기록 전달
    finally:
        app.dependency_overrides.pop(get_room_or_404, None)


def test_delete_without_user_id_still_works(client, monkeypatch):
    """하위호환: user_id 미지정 시 검증 스킵하고 삭제 (deleted_by=None)."""
    _override_room("owner-A")
    called = {}

    async def fake_delete(room_id, deleted_by=None):
        called["args"] = (room_id, deleted_by)
        return True

    monkeypatch.setattr(rooms_module, "delete_chat_room", fake_delete)
    try:
        resp = client.delete("/rooms/r1")
        assert resp.status_code == 200, resp.text
        assert called["args"] == ("r1", None)
    finally:
        app.dependency_overrides.pop(get_room_or_404, None)
