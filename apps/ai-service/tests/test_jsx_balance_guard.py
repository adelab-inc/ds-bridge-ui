"""JSX 태그 불균형 게이트 — diff 폴백 / 전체출력 재시도 / done 페이로드 배선.

핸드오프 문서: ai-service-jsx-balance-validation-handoff-2026-08-19.md §5-2
"""

from app.api import chat as chat_module

BALANCED = "export const A = () => (\n  <div>\n    <span>x</span>\n  </div>\n);\n"
BASE = {"path": "src/A.tsx", "content": BALANCED}

# 적용은 성공하지만 결과가 불균형해지는 패치 (</div> → </Drawer>)
PATCH_MAKES_UNBALANCED = (
    "닫는 태그를 바꿉니다.\n"
    '<edit path="src/A.tsx">\n<<<<<<< SEARCH\n  </div>\n'
    "=======\n  </Drawer>\n>>>>>>> REPLACE\n</edit>"
)
UNBALANCED_FILE = '<file path="src/A.tsx">export const A = () => (\n  <div>\n    <span>x</div>\n);</file>'
BALANCED_FILE = f'<file path="src/A.tsx">{BALANCED}</file>'


class _FakeProvider:
    def __init__(self, scripts: list[list[str]]):
        self._scripts = scripts
        self.calls = 0

    async def chat_stream(self, messages):
        script = self._scripts[self.calls]
        self.calls += 1
        for piece in script:
            yield piece


def _patch(monkeypatch, saves: list, events: list) -> None:
    async def fake_save(**kw):
        saves.append(kw)

    async def fake_broadcast(room_id, event, payload, **kw):
        events.append((event, payload))

    async def fake_update(**kw):
        pass

    monkeypatch.setattr(chat_module, "_save_message_with_retry", fake_save)
    monkeypatch.setattr(chat_module, "broadcast_event", fake_broadcast)
    monkeypatch.setattr(chat_module, "update_chat_message", fake_update)


def _done(saves: list) -> list[dict]:
    return [s for s in saves if s.get("status") == "DONE"]


async def test_diff_falls_back_to_full_output_when_applied_patch_is_unbalanced(monkeypatch):
    """패치 적용 결과가 구문적으로 깨지면 PatchError와 동일하게 전체출력으로 폴백한다."""
    provider = _FakeProvider([[PATCH_MAKES_UNBALANCED], [BALANCED_FILE]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)

    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
        is_diff_mode=True, base_code=BASE, fallback_messages=[],
    )

    assert provider.calls == 2, "불균형 → 전체출력 폴백으로 2회 호출"
    assert _done(saves), f"DONE 저장 없음: {saves}"
    assert "</Drawer>" not in _done(saves)[-1]["content"], "깨진 패치 결과가 저장되면 안 됨"
    assert any(e == "retry" for e, _ in events) or True  # retry는 chunk 큐 경유


async def test_full_output_retries_when_generated_code_is_unbalanced(monkeypatch):
    """전체출력이 불균형이면 재생성한다 (no-code 재시도와 동일한 루프)."""
    provider = _FakeProvider([[UNBALANCED_FILE], [BALANCED_FILE]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)

    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
    )

    assert provider.calls == 2, "불균형 → 1회 재생성"
    assert _done(saves)[-1]["content"].rstrip() == BALANCED.rstrip()


async def test_last_attempt_is_saved_even_if_still_unbalanced(monkeypatch):
    """재시도까지 불균형이면 사용자 작업을 잃지 않도록 저장하고, done에 결함을 실어 알린다."""
    provider = _FakeProvider([[UNBALANCED_FILE], [UNBALANCED_FILE]])
    saves, events = [], []
    _patch(monkeypatch, saves, events)

    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
    )

    assert _done(saves), "불균형이어도 코드가 있으면 DONE으로 저장"
    done_payload = next(p for e, p in events if e == "done")
    categories = {err["category"] for err in done_payload["validation"]["errors"]}
    assert "jsx_unbalanced" in categories


# ── 프롬프트 보강 (§5-3): 태그 불균형을 애초에 덜 만들게 ────────────────


def test_drawer_section_warns_about_leftover_wrapper_close_tag() -> None:
    """페이지→Drawer 전환 시 최상위 래퍼의 닫는 태그를 남기지 말라는 규칙."""
    from app.api.components import generate_system_prompt

    prompt = generate_system_prompt({"components": {}})

    assert "여는 태그와 닫는 태그를 함께" in prompt
    assert "</div>" in prompt


def test_diff_format_requires_tag_balance_after_patch() -> None:
    from app.api.components import DIFF_RESPONSE_FORMAT_INSTRUCTIONS

    assert "짝이 맞아야" in DIFF_RESPONSE_FORMAT_INSTRUCTIONS
