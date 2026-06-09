"""탈선 가드 단위 테스트.

모델이 코드(<file>)를 하나도 생성하지 않으면(=탈선/실패) DONE 대신 ERROR로
저장되고 done 대신 error 이벤트가 나가는지 검증한다.
(2026-06-09 헬스케어 요청에 호텔 기사가 DONE으로 저장·노출된 사고 방어막)
"""

from app.api import chat as chat_module
from app.services.ai_provider import Message


class FakeProvider:
    """chat_stream으로 지정한 텍스트 청크를 그대로 흘려보내는 가짜 프로바이더."""

    def __init__(self, texts: list[str]):
        self._texts = texts

    async def chat_stream(self, messages):  # noqa: ANN001
        for t in self._texts:
            yield t


def _patch(monkeypatch):
    saves: list[dict] = []
    events: list[tuple[str, dict]] = []

    async def fake_update(*, message_id, text=None, content=None, path=None, status=None):
        saves.append({"text": text, "content": content, "path": path, "status": status})

    async def fake_broadcast(room_id, event_type, payload, **kwargs):  # noqa: ANN001
        events.append((event_type, payload))

    monkeypatch.setattr(chat_module, "update_chat_message", fake_update)
    monkeypatch.setattr(chat_module, "broadcast_event", fake_broadcast)
    return saves, events


async def test_no_code_file_marks_error(monkeypatch):
    """코드 없는 탈선 응답(엉뚱한 기사) → ERROR, done 이벤트 없음."""
    saves, events = _patch(monkeypatch)

    provider = FakeProvider(
        ["The 10th edition of the annual awards ", "celebrating the best hotels..."]
    )
    await chat_module._run_broadcast_generation(
        room_id="r1",
        message_id="m1",
        user_id=None,
        provider=provider,
        messages=[Message(role="user", content="헬스케어 화면 만들어줘")],
        images=[],
        is_vision_mode=False,
    )

    event_types = [e[0] for e in events]
    assert "done" not in event_types, f"탈선인데 done이 나감: {event_types}"
    assert "error" in event_types, f"error 이벤트 누락: {event_types}"
    assert any(s["status"] == "ERROR" for s in saves), f"ERROR 저장 없음: {saves}"
    # 코드/경로는 저장되지 않아야 함
    assert all((s["content"] in (None, "")) for s in saves if s["status"] == "ERROR")


async def test_with_code_file_marks_done(monkeypatch):
    """정상 코드 응답 → DONE, error 이벤트 없음."""
    saves, events = _patch(monkeypatch)

    code = '코드입니다 <file path="src/App.tsx">export default function App(){return null}</file>'
    provider = FakeProvider([code])
    await chat_module._run_broadcast_generation(
        room_id="r1",
        message_id="m2",
        user_id=None,
        provider=provider,
        messages=[Message(role="user", content="버튼 만들어줘")],
        images=[],
        is_vision_mode=False,
    )

    event_types = [e[0] for e in events]
    assert "done" in event_types, f"정상인데 done 누락: {event_types}"
    assert "error" not in event_types, f"정상인데 error 발생: {event_types}"
    assert any(s["status"] == "DONE" for s in saves), f"DONE 저장 없음: {saves}"


async def test_fenced_code_recovered_marks_done(monkeypatch):
    """<file> 없이 ```tsx 펜스로만 온 코드 → 회수되어 DONE (가드 오탐 방지)."""
    saves, events = _patch(monkeypatch)

    fenced = (
        "요청하신 컴포넌트입니다.\n\n```tsx\n"
        "export default function App() { return <div>hi</div>; }\n"
        "```\n"
    )
    provider = FakeProvider([fenced])
    await chat_module._run_broadcast_generation(
        room_id="r1",
        message_id="m3",
        user_id=None,
        provider=provider,
        messages=[Message(role="user", content="앱 만들어줘")],
        images=[],
        is_vision_mode=False,
    )

    event_types = [e[0] for e in events]
    assert "error" not in event_types, f"펜스 코드인데 error(오탐): {event_types}"
    assert any(s["status"] == "DONE" for s in saves), f"DONE 저장 없음: {saves}"
    # 회수된 코드가 code 청크로 방출됐는지
    code_chunks = [p for t, p in events if t == "chunk" and p.get("type") == "code"]
    assert code_chunks, f"회수된 code 청크 없음: {[t for t, _ in events]}"
    assert "export default function App" in code_chunks[0]["content"]


def test_check_gemini_finish_logs_abnormal(caplog):
    """비정상 finish_reason(RECITATION) → 경고 로깅, 정상(STOP) → 무로깅."""
    import logging as _logging

    from app.services.ai_provider import _check_gemini_finish

    class _FR:
        def __init__(self, name):
            self.name = name

    class _Cand:
        def __init__(self, name):
            self.finish_reason = _FR(name)

    class _Resp:
        def __init__(self, name):
            self.candidates = [_Cand(name)]
            self.prompt_feedback = None

    with caplog.at_level(_logging.WARNING):
        _check_gemini_finish(_Resp("RECITATION"))
    assert any("abnormal finish_reason" in r.message for r in caplog.records)

    caplog.clear()
    with caplog.at_level(_logging.WARNING):
        _check_gemini_finish(_Resp("STOP"))
    assert not any("abnormal finish_reason" in r.message for r in caplog.records)
