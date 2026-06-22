"""StreamingParser diff 모드: 설명은 chat emit, 패치는 누적(broadcast 안 함)."""
from app.api.chat import StreamingParser

PATCH = (
    '<edit path="src/A.tsx">\n<<<<<<< SEARCH\nconst x = 1;\n'
    "=======\nconst x = 2;\n>>>>>>> REPLACE\n</edit>"
)


def _feed(parser, full, n=7):
    """문자열을 n자씩 청크로 흘려보내며 이벤트 수집."""
    events = []
    for i in range(0, len(full), n):
        events += parser.process_chunk(full[i : i + n])
    events += parser.flush()
    return events


def test_diff_chat_before_edit_is_emitted():
    p = StreamingParser(mode="diff")
    events = _feed(p, "x를 2로 바꿨습니다.\n" + PATCH)
    chat_text = "".join(e["text"] for e in events if e["type"] == "chat")
    assert "바꿨습니다" in chat_text


def test_diff_patch_not_emitted_as_chat():
    p = StreamingParser(mode="diff")
    events = _feed(p, "설명\n" + PATCH)
    all_text = "".join(e.get("text", "") for e in events)
    assert "<<<<<<< SEARCH" not in all_text
    assert not any(e["type"] == "code" for e in events)


def test_diff_get_patch_returns_full_patch():
    p = StreamingParser(mode="diff")
    _feed(p, "설명\n" + PATCH)
    patch = p.get_patch()
    assert "<<<<<<< SEARCH" in patch and ">>>>>>> REPLACE" in patch
    assert patch.count("<edit") == 1


def test_file_mode_unchanged():
    p = StreamingParser()  # 기본 file 모드
    events = _feed(p, '설명 <file path="src/A.tsx">const a=1;</file>')
    assert any(e["type"] == "code" for e in events)
