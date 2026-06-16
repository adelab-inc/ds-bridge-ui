"""외부 API 연결 실패 / Figma 빈 데이터 가드 테스트.

- _is_connection_error: 예외 체인에서 연결 실패를 식별
- 생성 중 연결 실패 → error_code=network_error 안내
- Figma prefetch 0건 → FigmaFetchError 발생(환각 코드 생성 차단)
"""

import httpx
import pytest

from app.api import chat as chat_module
from app.api.chat import _is_connection_error
from app.schemas.chat import Message
from app.services.figma_api import FigmaFetchError

# ----------------------------------------------------------------------------
# _is_connection_error
# ----------------------------------------------------------------------------

def test_is_connection_error_direct():
    assert _is_connection_error(httpx.ConnectError("boom")) is True
    assert _is_connection_error(httpx.ConnectTimeout("t")) is True
    assert _is_connection_error(httpx.ReadError("r")) is True


def test_is_connection_error_wrapped():
    """다른 예외로 감싸여도 __cause__ 체인에서 찾아낸다."""
    try:
        try:
            raise httpx.ConnectError("inner")
        except httpx.ConnectError as inner:
            raise RuntimeError("wrapped by genai/tenacity") from inner
    except RuntimeError as e:
        assert _is_connection_error(e) is True


def test_is_connection_error_false():
    assert _is_connection_error(ValueError("not a connection issue")) is False
    assert _is_connection_error(None) is False


# ----------------------------------------------------------------------------
# 생성 중 연결 실패 → network_error 안내
# ----------------------------------------------------------------------------

class _RaisingProvider:
    def __init__(self, exc: Exception):
        self._exc = exc

    async def chat_stream(self, messages):
        raise self._exc
        yield ""  # 도달 불가 — async generator로 만들기 위한 더미 yield


async def test_connection_error_marks_network_error(monkeypatch):
    saves: list[dict] = []
    events: list[tuple[str, dict]] = []

    async def fake_update(*, message_id, text=None, content=None, path=None, status=None):
        saves.append({"status": status})

    async def fake_broadcast(room_id, event_type, payload, **kwargs):  # noqa: ANN001
        events.append((event_type, payload))

    monkeypatch.setattr(chat_module, "update_chat_message", fake_update)
    monkeypatch.setattr(chat_module, "broadcast_event", fake_broadcast)

    await chat_module._run_broadcast_generation(
        room_id="r1",
        message_id="m1",
        user_id=None,
        provider=_RaisingProvider(httpx.ConnectError("TLS handshake failed")),
        messages=[Message(role="user", content="화면 만들어줘")],
        images=[],
        is_vision_mode=False,
    )

    error_events = [p for t, p in events if t == "error"]
    assert error_events, f"error 이벤트 없음: {[t for t, _ in events]}"
    assert error_events[0].get("error_code") == "network_error", error_events[0]
    assert any(s["status"] == "ERROR" for s in saves)


# ----------------------------------------------------------------------------
# Figma prefetch 0건 → FigmaFetchError (환각 차단)
# ----------------------------------------------------------------------------

async def test_figma_empty_prefetch_raises(monkeypatch):
    from app.services import tool_calling_loop as tcl

    async def _none():
        return None

    async def _noop_broadcast(*a, **k):  # noqa: ANN002, ANN003
        return None

    # 모든 Figma 호출이 데이터를 못 가져오는 상황 재현
    monkeypatch.setattr(tcl, "fetch_page_structure", lambda *a, **k: _none())
    monkeypatch.setattr(tcl, "export_node_image", lambda *a, **k: _none())
    monkeypatch.setattr(tcl, "fetch_node_detail", lambda *a, **k: _none())
    monkeypatch.setattr(tcl, "broadcast_event", _noop_broadcast)

    gen = tcl.run_figma_tool_calling_loop(
        room_id="r1",
        provider=object(),
        system_prompt="",
        user_message="x",
        figma_url="https://www.figma.com/design/ABC123/Test?node-id=1-2",
    )

    with pytest.raises(FigmaFetchError):
        async for _ in gen:
            pass
