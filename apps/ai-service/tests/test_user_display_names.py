"""list_all_users 표시명 오버레이 테스트.

- user_display_names 매핑이 있으면 user_metadata.name 보다 우선
- 매핑 없으면 metadata(full_name/name) 폴백
- 테이블 미생성/조회 실패 시 graceful (크래시 없이 metadata 폴백)
supabase 클라이언트는 가짜로 주입.
"""

from app.services import supabase_db


class _User:
    def __init__(self, uid, email, meta):
        self.id = uid
        self.email = email
        self.user_metadata = meta


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, data, raises=False):
        self._data = data
        self._raises = raises

    def select(self, *a, **k):
        return self

    async def execute(self):
        if self._raises:
            raise RuntimeError("relation user_display_names does not exist")
        return _Resp(self._data)


class _Admin:
    def __init__(self, users):
        self._users = users

    async def list_users(self, page=1, per_page=200):
        return self._users if page == 1 else []


class _Client:
    def __init__(self, users, dn_rows, dn_raises=False):
        self.auth = type("A", (), {"admin": _Admin(users)})()
        self._dn_rows = dn_rows
        self._dn_raises = dn_raises

    def table(self, name):
        return _Query(self._dn_rows, self._dn_raises)


def _patch(monkeypatch, users, dn_rows, dn_raises=False):
    client = _Client(users, dn_rows, dn_raises)

    async def fake_get_client():
        return client

    monkeypatch.setattr(supabase_db, "get_supabase_client", fake_get_client)


async def test_override_wins_over_metadata(monkeypatch):
    users = [_User("u1", "a@b.com", {"full_name": "메타이름"}), _User("u2", "c@d.com", {})]
    _patch(monkeypatch, users, [{"user_id": "u1", "display_name": "운영자지정"}])
    res = {u["id"]: u for u in await supabase_db.list_all_users()}
    assert res["u1"]["name"] == "운영자지정"  # 매핑 우선
    assert res["u2"]["name"] is None          # 매핑·메타 둘 다 없음


async def test_fallback_to_metadata(monkeypatch):
    users = [_User("u1", "a@b.com", {"full_name": "메타이름"})]
    _patch(monkeypatch, users, [])  # 오버라이드 없음
    res = await supabase_db.list_all_users()
    assert res[0]["name"] == "메타이름"


async def test_graceful_when_table_missing(monkeypatch):
    users = [_User("u1", "a@b.com", {"name": "메타"})]
    _patch(monkeypatch, users, [], dn_raises=True)  # 테이블 조회 실패
    res = await supabase_db.list_all_users()
    assert res[0]["name"] == "메타"  # 크래시 없이 폴백
