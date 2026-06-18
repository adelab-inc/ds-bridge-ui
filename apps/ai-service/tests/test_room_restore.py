"""아카이브 복구(restore_*) 테스트.

- 전체 복구: 방 + 메시지 + 디스크립션
- 부분 복구: 지정 메시지만 (디스크립션 스킵)
- 이미 있는 방은 재삽입 스킵
- 아카이브 없으면 ValueError
- 메시지 복구는 방이 살아있어야 함
"""

import pytest

from app.services.supabase_db import (
    restore_message_from_archive,
    restore_room_from_archive,
)


class _Resp:
    def __init__(self, data):
        self.data = data


class _Q:
    def __init__(self, name, client):
        self.name = name
        self.client = client
        self._op = "select"
        self._payload = None

    def select(self, *a, **k):
        self._op = "select"
        return self

    def eq(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = payload
        return self

    def upsert(self, payload):
        self._op = "upsert"
        self._payload = payload
        return self

    async def execute(self):
        if self._op in ("insert", "upsert"):
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            self.client.written.setdefault(self.name, []).extend(rows)
            return _Resp(rows)
        return _Resp(self.client.tables.get(self.name, []))


class _Client:
    def __init__(self, tables):
        self.tables = tables
        self.written = {}

    def table(self, name):
        return _Q(name, self)


def _archive_row():
    return {
        "room_id": "r1",
        "payload": {
            "room": {"id": "r1", "user_id": "u1"},
            "messages": [{"id": "m1"}, {"id": "m2"}],
            "descriptions": [{"id": "d1"}],
        },
    }


async def test_restore_full_room(monkeypatch):
    client = _Client({"deleted_room_archive": [_archive_row()], "chat_rooms": []})
    monkeypatch.setattr("app.services.supabase_db.get_supabase_client", lambda: _async(client))
    out = await restore_room_from_archive("r1")
    assert out == {"room": True, "messages": 2, "descriptions": 1}
    assert client.written["chat_rooms"][0]["id"] == "r1"
    assert len(client.written["chat_messages"]) == 2
    assert len(client.written["descriptions"]) == 1


async def test_restore_partial_messages(monkeypatch):
    client = _Client({"deleted_room_archive": [_archive_row()], "chat_rooms": []})
    monkeypatch.setattr("app.services.supabase_db.get_supabase_client", lambda: _async(client))
    out = await restore_room_from_archive("r1", message_ids=["m1"])
    assert out["messages"] == 1  # m1만
    assert out["descriptions"] == 0  # 부분 복구 시 디스크립션 스킵
    assert client.written["chat_messages"][0]["id"] == "m1"


async def test_restore_skips_existing_room(monkeypatch):
    client = _Client({"deleted_room_archive": [_archive_row()], "chat_rooms": [{"id": "r1"}]})
    monkeypatch.setattr("app.services.supabase_db.get_supabase_client", lambda: _async(client))
    out = await restore_room_from_archive("r1")
    assert out["room"] is False  # 이미 있으면 재삽입 안 함
    assert out["messages"] == 2  # 메시지는 복원


async def test_restore_raises_when_no_archive(monkeypatch):
    client = _Client({"deleted_room_archive": [], "chat_rooms": []})
    monkeypatch.setattr("app.services.supabase_db.get_supabase_client", lambda: _async(client))
    with pytest.raises(ValueError, match="No archive"):
        await restore_room_from_archive("r1")


async def test_restore_message_ok(monkeypatch):
    client = _Client({
        "deleted_message_archive": [{"payload": {"id": "m1", "room_id": "r1"}}],
        "chat_rooms": [{"id": "r1"}],
    })
    monkeypatch.setattr("app.services.supabase_db.get_supabase_client", lambda: _async(client))
    assert await restore_message_from_archive("m1") is True
    assert client.written["chat_messages"][0]["id"] == "m1"


async def test_restore_strips_generated_columns(monkeypatch):
    """복구 재삽입 시 DB 생성 컬럼(code_hash/description_hash)은 제외돼야 함 (Postgres 거부 방지)."""
    archive = {
        "room_id": "r1",
        "payload": {
            "room": {"id": "r1", "user_id": "u1"},
            "messages": [{"id": "m1", "content": "code", "code_hash": "GEN"}],
            "descriptions": [{"id": "d1", "content": "desc", "description_hash": "GEN"}],
        },
    }
    client = _Client({"deleted_room_archive": [archive], "chat_rooms": []})
    monkeypatch.setattr("app.services.supabase_db.get_supabase_client", lambda: _async(client))
    await restore_room_from_archive("r1")
    msg = client.written["chat_messages"][0]
    desc = client.written["descriptions"][0]
    assert "code_hash" not in msg and msg["id"] == "m1"  # 생성 컬럼만 제거, 나머지 유지
    assert "description_hash" not in desc and desc["id"] == "d1"


async def test_restore_message_raises_when_room_gone(monkeypatch):
    client = _Client({
        "deleted_message_archive": [{"payload": {"id": "m1", "room_id": "r1"}}],
        "chat_rooms": [],
    })
    monkeypatch.setattr("app.services.supabase_db.get_supabase_client", lambda: _async(client))
    with pytest.raises(ValueError, match="room .* does not exist"):
        await restore_message_from_archive("m1")


async def _async(val):
    return val
