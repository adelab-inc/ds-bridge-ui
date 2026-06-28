"""방 copy/move + 멤버 목록 테스트.

- copy/move: 소유자 본인만(JWT uid 불일치 → 403), 소유자면 대상 user_id로 위임 호출
- JWT 비활성(uid=None)이면 소유권 체크 스킵
- GET /users: 멤버 목록 반환
외부 의존(supabase_db 함수)은 monkeypatch.
"""

from app.api import rooms as rooms_module
from app.api import users as users_module
from app.api.rooms import get_room_or_404
from app.core.auth import get_current_user_id
from app.main import app

_ROOM = {"id": "r1", "user_id": "owner-A", "schema_key": "k", "storybook_url": "t", "created_at": 1}
_NEWROOM = {"id": "r2", "user_id": "target-X", "schema_key": "k", "storybook_url": "t", "created_at": 2}


def _override(owner: str, uid: str | None):
    app.dependency_overrides[get_room_or_404] = lambda: {**_ROOM, "user_id": owner}
    app.dependency_overrides[get_current_user_id] = lambda: uid


def _clear():
    app.dependency_overrides.pop(get_room_or_404, None)
    app.dependency_overrides.pop(get_current_user_id, None)


# ── copy ──────────────────────────────────────────────────────

def test_copy_forbidden_when_not_owner(client, monkeypatch):
    _override(owner="owner-A", uid="other-B")
    called = {}

    async def fake_copy(source_room_id, target_user_id):
        called["hit"] = True
        return _NEWROOM

    monkeypatch.setattr(rooms_module, "copy_room_to_user", fake_copy)
    try:
        resp = client.post("/rooms/r1/copy", json={"target_user_id": "target-X"})
        assert resp.status_code == 403, resp.text
        assert "hit" not in called  # 복제 호출 자체가 안 됨
    finally:
        _clear()


def test_copy_ok_when_owner(client, monkeypatch):
    _override(owner="owner-A", uid="owner-A")
    called = {}

    async def fake_copy(source_room_id, target_user_id):
        called["args"] = (source_room_id, target_user_id)
        return _NEWROOM

    monkeypatch.setattr(rooms_module, "copy_room_to_user", fake_copy)
    try:
        resp = client.post("/rooms/r1/copy", json={"target_user_id": "target-X"})
        assert resp.status_code == 201, resp.text
        assert called["args"] == ("r1", "target-X")
        body = resp.json()
        assert body["id"] == "r2" and body["user_id"] == "target-X"  # 새 방, 대상 소유
    finally:
        _clear()


def test_copy_dev_mode_skips_check(client, monkeypatch):
    """JWT 비활성(uid=None)이면 소유권 검증 스킵."""
    _override(owner="owner-A", uid=None)

    async def fake_copy(source_room_id, target_user_id):
        return _NEWROOM

    monkeypatch.setattr(rooms_module, "copy_room_to_user", fake_copy)
    try:
        resp = client.post("/rooms/r1/copy", json={"target_user_id": "target-X"})
        assert resp.status_code == 201, resp.text
    finally:
        _clear()


# ── move ──────────────────────────────────────────────────────

def test_move_forbidden_when_not_owner(client, monkeypatch):
    _override(owner="owner-A", uid="other-B")
    called = {}

    async def fake_move(room_id, target_user_id):
        called["hit"] = True
        return {**_ROOM, "user_id": target_user_id}

    monkeypatch.setattr(rooms_module, "move_room_to_user", fake_move)
    try:
        resp = client.post("/rooms/r1/move", json={"target_user_id": "target-X"})
        assert resp.status_code == 403, resp.text
        assert "hit" not in called
    finally:
        _clear()


def test_move_ok_when_owner(client, monkeypatch):
    _override(owner="owner-A", uid="owner-A")
    called = {}

    async def fake_move(room_id, target_user_id):
        called["args"] = (room_id, target_user_id)
        return {**_ROOM, "user_id": target_user_id}

    monkeypatch.setattr(rooms_module, "move_room_to_user", fake_move)
    try:
        resp = client.post("/rooms/r1/move", json={"target_user_id": "target-X"})
        assert resp.status_code == 200, resp.text
        assert called["args"] == ("r1", "target-X")
        assert resp.json()["user_id"] == "target-X"  # 소유권 이전됨
    finally:
        _clear()


# ── members ───────────────────────────────────────────────────

def test_list_users(client, monkeypatch):
    async def fake_list():
        return [
            {"id": "u1", "email": "a@b.com", "name": "에이", "avatar_url": None},
            {"id": "u2", "email": "c@d.com", "name": None, "avatar_url": "http://x/y.png"},
        ]

    monkeypatch.setattr(users_module, "list_all_users", fake_list)
    resp = client.get("/users")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 2
    assert body["users"][0]["id"] == "u1" and body["users"][0]["email"] == "a@b.com"
    assert body["users"][1]["name"] is None  # 이름 없는 유저도 허용
