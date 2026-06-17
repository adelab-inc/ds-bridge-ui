"""삭제 전 아카이브(_archive_room_before_delete) 테스트.

- 방+메시지+디스크립션 스냅샷이 deleted_room_archive에 insert되는지
- 아카이브 실패가 예외로 터지지 않는지(best-effort → 삭제 진행 보장)
"""

from app.services.supabase_db import _archive_room_before_delete


class _Resp:
    def __init__(self, data):
        self.data = data


class _Q:
    def __init__(self, name, store):
        self.name = name
        self.store = store
        self._payload = None

    def select(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def insert(self, payload):
        self._payload = payload
        return self

    async def execute(self):
        if self._payload is not None:
            self.store["archived"] = self._payload
            return _Resp([self._payload])
        return _Resp(self.store["data"].get(self.name, []))


class _Client:
    def __init__(self, data):
        self.store = {"data": data, "archived": None}

    def table(self, name):
        return _Q(name, self.store)


async def test_archive_snapshots_room_messages_descriptions():
    client = _Client({
        "chat_rooms": [{"id": "r1", "user_id": "u1"}],
        "chat_messages": [{"id": "m1"}, {"id": "m2"}],
        "descriptions": [{"id": "d1"}],
    })
    await _archive_room_before_delete(client, "r1", "u1")
    arch = client.store["archived"]
    assert arch is not None, "아카이브 insert가 호출되지 않음"
    assert arch["room_id"] == "r1"
    assert arch["deleted_by"] == "u1"
    assert arch["payload"]["room"]["id"] == "r1"
    assert len(arch["payload"]["messages"]) == 2
    assert len(arch["payload"]["descriptions"]) == 1


async def test_archive_skips_when_room_missing():
    client = _Client({"chat_rooms": [], "chat_messages": [], "descriptions": []})
    await _archive_room_before_delete(client, "nope", "u1")
    assert client.store["archived"] is None  # 방 없으면 아카이브 안 함


async def test_archive_failure_does_not_raise():
    class _Boom:
        def table(self, name):
            raise RuntimeError("boom")

    # best-effort: 예외가 밖으로 새지 않아야 함 (삭제가 막히면 안 됨)
    await _archive_room_before_delete(_Boom(), "r1", "u1")
