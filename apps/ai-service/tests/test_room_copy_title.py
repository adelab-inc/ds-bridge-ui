"""copy_room_to_user 제목 접미사 테스트.

복제본은 storybook_url(제목)에 "(복제본 YYMMDD_HHmmss)" 접미사가 붙어 원본과 구분돼야 한다.
copy_room_to_user 는 내부에서 get_supabase_client() 를 호출하므로 fake client 로 monkeypatch.
"""

import re

from app.services import supabase_db
from app.services.supabase_db import copy_room_to_user


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
            self.store["inserts"][self.name] = self._payload
            return _Resp(self._payload if isinstance(self._payload, list) else [self._payload])
        return _Resp(self.store["data"].get(self.name, []))


class _Client:
    def __init__(self, data):
        self.store = {"data": data, "inserts": {}}

    def table(self, name):
        return _Q(name, self.store)


_SUFFIX = re.compile(r"\(복제본 \d{6}_\d{6}\)$")


async def test_copy_appends_suffix_and_keeps_original_title(monkeypatch):
    client = _Client({
        "chat_rooms": [{"id": "r1", "user_id": "owner-A", "schema_key": "k", "storybook_url": "증원후보자관리"}],
        "chat_messages": [{"id": "m1", "room_id": "r1", "content": "x"}],
        "descriptions": [],
    })

    async def fake_get():
        return client

    monkeypatch.setattr(supabase_db, "get_supabase_client", fake_get)
    new = await copy_room_to_user("r1", "owner-A")

    title = client.store["inserts"]["chat_rooms"]["storybook_url"]
    assert title.startswith("증원후보자관리 (복제본 "), title  # 원제목 보존
    assert _SUFFIX.search(title), title  # YYMMDD_HHmmss 형식
    assert new["id"] != "r1" and new["user_id"] == "owner-A"  # 새 방, 대상 소유


async def test_copy_title_when_source_has_no_title(monkeypatch):
    """원제목이 없으면 접미사만 단독으로."""
    client = _Client({
        "chat_rooms": [{"id": "r1", "user_id": "o", "schema_key": None, "storybook_url": None}],
        "chat_messages": [],
        "descriptions": [],
    })

    async def fake_get():
        return client

    monkeypatch.setattr(supabase_db, "get_supabase_client", fake_get)
    await copy_room_to_user("r1", "o")

    title = client.store["inserts"]["chat_rooms"]["storybook_url"]
    assert re.fullmatch(r"\(복제본 \d{6}_\d{6}\)", title), title
