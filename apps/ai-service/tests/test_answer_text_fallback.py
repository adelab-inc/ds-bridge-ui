"""답변 텍스트가 비는 문제 — 모델이 설명 없이 코드/패치만 낼 때 최소 문구를 채운다.

실측(prod): 최근 3,000건 중 411건(13.7%)이 코드는 정상인데 text 가 0자였다.
사용자에게는 "요청했는데 응답이 없음"으로 보인다. 재생성 없이 저장 직전에 보완한다.
"""

from app.api import chat as chat_module

BALANCED = "export const A = () => (\n  <div>\n    <span>x</span>\n  </div>\n);\n"
BASE = {"path": "src/A.tsx", "content": BALANCED}

# 설명 문장 없이 <edit> 만 (실측된 모델 출력 패턴)
PATCH_ONLY = (
    '<edit path="src/A.tsx">\n<<<<<<< SEARCH\n    <span>x</span>\n'
    "=======\n    <span>y</span>\n>>>>>>> REPLACE\n</edit>"
)
FILE_ONLY = f'<file path="src/A.tsx">{BALANCED}</file>'
FILE_WITH_TEXT = f'로그인 폼을 만들었습니다.\n<file path="src/A.tsx">{BALANCED}</file>'


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


def _done(saves):
    return [s for s in saves if s.get("status") == "DONE"]


async def test_diff_without_prose_gets_fallback_text(monkeypatch):
    """diff 적용은 성공했는데 설명이 없으면 최소 문구를 채운다."""
    provider = _FakeProvider([[PATCH_ONLY]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)

    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
        is_diff_mode=True, base_code=BASE, fallback_messages=[],
    )

    text = _done(saves)[-1]["text"]
    assert text, "빈 텍스트로 저장되면 채팅이 비어 보인다"
    assert "수정" in text
    assert "1" in text, f"편집 개수를 알려주면 좋다: {text!r}"


async def test_full_output_without_prose_gets_fallback_text(monkeypatch):
    provider = _FakeProvider([[FILE_ONLY]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)

    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
    )

    text = _done(saves)[-1]["text"]
    assert text, "빈 텍스트로 저장되면 채팅이 비어 보인다"
    assert "src/A.tsx" in text or "코드" in text


async def test_model_prose_is_never_overwritten(monkeypatch):
    """모델이 설명을 썼으면 그대로 둔다 (폴백이 덮어쓰면 안 됨)."""
    provider = _FakeProvider([[FILE_WITH_TEXT]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)

    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
    )

    assert _done(saves)[-1]["text"] == "로그인 폼을 만들었습니다."


# ── 변경이 실제로 없었던 경우 (#187 후속) ────────────────────────────────

# SEARCH 와 REPLACE 가 동일 = 아무것도 바꾸지 않는 패치.
# 실측: room 02fa4dd0 에서 같은 요청 4연속, 매번 edits=1 / result_len 46203 동일,
# 답변 텍스트 0자 → 사용자는 아무 반응이 없어 계속 재요청했다.
NOOP_PATCH = (
    '<edit path="src/A.tsx">\n<<<<<<< SEARCH\n    <span>x</span>\n'
    "=======\n    <span>x</span>\n>>>>>>> REPLACE\n</edit>"
)


async def test_noop_diff_says_nothing_changed(monkeypatch):
    """적용 결과가 base 와 동일하면 '수정했다'가 아니라 '변경 없음'을 알려야 한다."""
    provider = _FakeProvider([[NOOP_PATCH]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)

    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
        is_diff_mode=True, base_code=BASE, fallback_messages=[],
    )

    text = _done(saves)[-1]["text"]
    assert "변경" in text and "없" in text, f"변경 없음을 알려야 함: {text!r}"
    assert "수정했습니다" not in text, f"거짓 안내: {text!r}"


PROSE_NOOP = "관리자 제재 컬럼 표기를 요청하신 대로 변경하였습니다.\n" + NOOP_PATCH


async def test_noop_diff_appends_notice_when_model_wrote_prose(monkeypatch):
    """모델이 '변경하였습니다'라고 쓰고 실제로는 아무것도 안 바꾼 경우.

    실측(room 00474737, 09-03 13:20/13:23): 같은 요청 재시도에 모델이
    "요청하신 대로 변경하였습니다"라고 답했지만 코드는 1바이트도 안 바뀌었다.
    모델 문구는 보존하고 사실을 덧붙인다.
    """
    provider = _FakeProvider([[PROSE_NOOP]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)

    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
        is_diff_mode=True, base_code=BASE, fallback_messages=[],
    )

    text = _done(saves)[-1]["text"]
    assert "변경하였습니다" in text, "모델이 쓴 설명은 보존해야 함"
    assert "변경된 부분이 없" in text, f"실제 변경 없음을 알려야 함: {text!r}"
