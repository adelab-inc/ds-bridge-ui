"""diff 모드 생성 통합: 패치 적용→전체파일 저장, 실패→전체출력 폴백, 패치 비broadcast."""
from app.api import chat as chat_module

BASE = {"path": "src/A.tsx", "content": "const x = 1;\nexport default 0;\n"}
PATCH_TEXT = (
    "x를 2로 바꿉니다.\n"
    '<edit path="src/A.tsx">\n<<<<<<< SEARCH\nconst x = 1;\n'
    "=======\nconst x = 2;\n>>>>>>> REPLACE\n</edit>"
)
FILE_CODE = '<file path="src/A.tsx">const x = 2;\nexport default 0;</file>'


class _FakeProvider:
    def __init__(self, scripts):
        self._scripts = scripts
        self.calls = 0

    async def chat_stream(self, messages):
        script = self._scripts[self.calls]
        self.calls += 1
        for piece in script:
            yield piece


def _patch(monkeypatch, saves, events):
    async def fake_save(**kw):
        saves.append(kw)

    async def fake_broadcast(room_id, event, payload, **kw):
        events.append((event, payload))

    async def fake_update(**kw):
        pass

    monkeypatch.setattr(chat_module, "_save_message_with_retry", fake_save)
    monkeypatch.setattr(chat_module, "broadcast_event", fake_broadcast)
    monkeypatch.setattr(chat_module, "update_chat_message", fake_update)


async def test_diff_success_applies_patch_and_saves_full_file(monkeypatch):
    provider = _FakeProvider([[PATCH_TEXT]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)
    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
        is_diff_mode=True, base_code=BASE, fallback_messages=[],
    )
    assert provider.calls == 1, "diff는 단일 생성"
    done = [s for s in saves if s.get("status") == "DONE"]
    assert done, f"DONE 저장 없음: {saves}"
    assert done[-1]["content"] == "const x = 2;\nexport default 0;\n"
    chat_text = "".join(p.get("text", "") for e, p in events if e == "chunk")
    assert "<<<<<<< SEARCH" not in chat_text


async def test_diff_patch_error_falls_back_to_full_output(monkeypatch):
    bad_patch = (
        '<edit path="src/A.tsx">\n<<<<<<< SEARCH\nNONEXISTENT LINE\n'
        "=======\nwhatever\n>>>>>>> REPLACE\n</edit>"
    )
    provider = _FakeProvider([[bad_patch], [FILE_CODE]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)
    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
        is_diff_mode=True, base_code=BASE, fallback_messages=[],
    )
    assert provider.calls == 2, "PatchError → 전체출력 재생성 1회"
    done = [s for s in saves if s.get("status") == "DONE"]
    assert done and "const x = 2;" in done[-1]["content"]


async def test_non_diff_path_unchanged(monkeypatch):
    provider = _FakeProvider([[FILE_CODE]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)
    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
    )
    assert provider.calls == 1
    assert any(s.get("status") == "DONE" for s in saves)
