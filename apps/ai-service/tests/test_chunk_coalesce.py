"""broadcast 청크 coalescing 테스트 — 연속 chat 텍스트가 합쳐져 전송되는지.

토큰마다 POST하던 것을 묶어 POST 횟수를 줄이는 게 목적(Supabase broadcast 포화 완화).
"""

from app.api import chat as chat_module
from app.schemas.chat import Message


class FakeProvider:
    def __init__(self, texts: list[str]):
        self._texts = texts

    async def chat_stream(self, messages):  # noqa: ANN001
        for t in self._texts:
            yield t


async def test_chat_chunks_are_coalesced(monkeypatch):
    saves: list[dict] = []
    events: list[tuple[str, dict]] = []

    async def fake_update(*, message_id, text=None, content=None, path=None, status=None):
        saves.append({"status": status})

    async def fake_broadcast(room_id, event_type, payload, **kwargs):  # noqa: ANN001
        events.append((event_type, payload))

    monkeypatch.setattr(chat_module, "update_chat_message", fake_update)
    monkeypatch.setattr(chat_module, "broadcast_event", fake_broadcast)

    # 작은 chat 조각 여러 개 + 마지막에 코드 파일 (총 <400자 → 한 번에 합쳐져야 함)
    texts = ["조각1 ", "조각2 ", "조각3 ", "조각4 ",
             '<file path="src/A.tsx">export default function A(){return null}</file>']
    await chat_module._run_broadcast_generation(
        room_id="r1",
        message_id="m1",
        user_id=None,
        provider=FakeProvider(texts),
        messages=[Message(role="user", content="만들어줘")],
        images=[],
        is_vision_mode=False,
    )

    chat_chunks = [p for t, p in events if t == "chunk" and p.get("type") == "chat"]
    # 4개 조각이 1번의 broadcast로 합쳐져야 함 (토큰별 4번이 아니라)
    assert len(chat_chunks) == 1, f"coalesce 실패: chat broadcast {len(chat_chunks)}회"
    # 텍스트는 보존
    joined = chat_chunks[0]["text"]
    assert "조각1" in joined and "조각4" in joined
    # 정상 완료 (code 있음 → DONE)
    assert any(s["status"] == "DONE" for s in saves)
    # code 이벤트도 정상 전송됨
    assert any(t == "chunk" and p.get("type") == "code" for t, p in events)
