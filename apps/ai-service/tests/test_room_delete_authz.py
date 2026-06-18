"""채팅방/메시지 삭제 인가 테스트 (제로트러스트 — JWT uid 기반).

- 소유자가 아니면(JWT uid 불일치) 403 → 삭제 안 됨
- 소유자면 200 + delete_*에 deleted_by(uid) 전달
- JWT 검증 비활성(uid=None, 개발/롤아웃 전)이면 기존처럼 삭제 진행
"""

from app.api import rooms as rooms_module
from app.api.rooms import get_room_or_404
from app.core.auth import get_current_user_id
from app.main import app


def _override(owner: str, uid: str | None):
    app.dependency_overrides[get_room_or_404] = lambda: {"id": "r1", "user_id": owner}
    app.dependency_overrides[get_current_user_id] = lambda: uid


def _clear():
    app.dependency_overrides.pop(get_room_or_404, None)
    app.dependency_overrides.pop(get_current_user_id, None)


# ── 방 삭제 ───────────────────────────────────────────────────

def test_delete_forbidden_when_not_owner(client, monkeypatch):
    _override(owner="owner-A", uid="other-B")
    called = {}

    async def fake_delete(room_id, deleted_by=None):
        called["hit"] = True
        return True

    monkeypatch.setattr(rooms_module, "delete_chat_room", fake_delete)
    try:
        resp = client.delete("/rooms/r1")
        assert resp.status_code == 403, resp.text
        assert "hit" not in called  # 삭제 호출 자체가 안 됨
    finally:
        _clear()


def test_delete_ok_and_logs_deleter_when_owner(client, monkeypatch):
    _override(owner="owner-A", uid="owner-A")
    called = {}

    async def fake_delete(room_id, deleted_by=None):
        called["args"] = (room_id, deleted_by)
        return True

    monkeypatch.setattr(rooms_module, "delete_chat_room", fake_delete)
    try:
        resp = client.delete("/rooms/r1")
        assert resp.status_code == 200, resp.text
        assert called["args"] == ("r1", "owner-A")  # 삭제자(uid) 기록 전달
    finally:
        _clear()


def test_delete_dev_mode_skips_check(client, monkeypatch):
    """JWT 검증 비활성(uid=None)이면 소유권 검증 스킵하고 삭제 (시크릿 켜기 전)."""
    _override(owner="owner-A", uid=None)
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
        _clear()


# ── 메시지 삭제 (방 소유자 기준) ──────────────────────────────

def test_message_delete_forbidden_when_not_owner(client, monkeypatch):
    _override(owner="owner-A", uid="other-B")
    called = {}

    async def fake_delete(message_id, deleted_by=None):
        called["hit"] = True
        return True

    monkeypatch.setattr(rooms_module, "delete_chat_message", fake_delete)
    try:
        resp = client.delete("/rooms/r1/messages/m1")
        assert resp.status_code == 403, resp.text
        assert "hit" not in called
    finally:
        _clear()


def test_message_delete_ok_when_owner(client, monkeypatch):
    _override(owner="owner-A", uid="owner-A")
    called = {}

    async def fake_delete(message_id, deleted_by=None):
        called["args"] = (message_id, deleted_by)
        return True

    monkeypatch.setattr(rooms_module, "delete_chat_message", fake_delete)
    try:
        resp = client.delete("/rooms/r1/messages/m1")
        assert resp.status_code == 200, resp.text
        assert called["args"] == ("m1", "owner-A")
    finally:
        _clear()
