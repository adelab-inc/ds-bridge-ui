"""no-code 재시도(TASK 1) 동작 테스트.

간헐적 thinking 폭주로 <file> 코드가 안 나오면(=no-code) 자동 재생성하고,
재시도까지 실패하면 ERROR 처리하는지 검증한다.
_run_broadcast_generation 의 외부 의존(broadcast/DB 저장)은 모킹한다.
"""

from app.api import chat as chat_module

CODE = '<file path="src/A.tsx">const A = () => null;\nexport default A;</file>'


class _FakeProvider:
    """attempt별 스트림 스크립트를 순서대로 내보내는 가짜 프로바이더."""

    def __init__(self, scripts: list[list[str]]):
        self._scripts = scripts
        self.calls = 0

    async def chat_stream(self, messages):
        script = self._scripts[self.calls]
        self.calls += 1
        for piece in script:
            yield piece


def _patch(monkeypatch, saves: list, events: list):
    async def fake_save(**kwargs):
        saves.append(kwargs)

    async def fake_broadcast(room_id, event, payload, **kw):
        events.append((event, payload))

    async def fake_update(**kwargs):
        pass

    monkeypatch.setattr(chat_module, "_save_message_with_retry", fake_save)
    monkeypatch.setattr(chat_module, "broadcast_event", fake_broadcast)
    monkeypatch.setattr(chat_module, "update_chat_message", fake_update)


async def _run(provider):
    await chat_module._run_broadcast_generation(
        room_id="r1", message_id="m1", user_id="u1",
        provider=provider, messages=[], images=[], is_vision_mode=False,
    )


async def test_retry_recovers_when_first_attempt_has_no_code(monkeypatch):
    # 1차: 코드 없음(설명만), 2차(재시도): <file> 코드 포함 → 성공해야 함
    provider = _FakeProvider([
        ["사업단별 배분현황 그리드입니다."],
        ["설명 ", CODE],
    ])
    saves: list = []
    events: list = []
    _patch(monkeypatch, saves, events)

    await _run(provider)

    assert provider.calls == 2, "no-code면 1회 재시도해야 함"
    done = [s for s in saves if s.get("status") == "DONE"]
    assert done, f"성공 저장(DONE) 없음: {saves}"
    assert "A.tsx" in done[-1].get("path", "")
    # FE에 retry 신호(chunk type=retry)가 broadcast 됨
    assert any(p.get("type") == "retry" for e, p in events if e == "chunk"), "retry 신호 없음"


async def test_no_retry_when_first_attempt_has_code(monkeypatch):
    provider = _FakeProvider([["설명 ", CODE]])  # 1차에 코드 → 재시도 없음
    saves: list = []
    events: list = []
    _patch(monkeypatch, saves, events)

    await _run(provider)

    assert provider.calls == 1, "코드 있으면 재시도 없음"
    assert any(s.get("status") == "DONE" for s in saves)
    assert not any(p.get("type") == "retry" for e, p in events if e == "chunk")


async def test_error_when_all_attempts_no_code(monkeypatch):
    provider = _FakeProvider([["설명만 1"], ["설명만 2"]])  # 둘 다 no-code
    saves: list = []
    events: list = []
    _patch(monkeypatch, saves, events)

    await _run(provider)

    assert provider.calls == 2, "재시도까지 모두 소진"
    assert any(s.get("status") == "ERROR" for s in saves), "최종 ERROR 저장 있어야"
    assert any(e == "error" for e, _ in events), "error broadcast 있어야"
