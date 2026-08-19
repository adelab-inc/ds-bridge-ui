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


def test_diff_edit_tag_split_across_chunks():
    # <edit 태그가 청크 경계에서 쪼개져도 부분 태그를 chat으로 흘리지 않고
    # 패치는 <edit부터 깨끗하게 시작해야 한다.
    p = StreamingParser(mode="diff")
    chat = ""
    chunks = [
        "설명입니다<",
        'edit path="src/A.tsx">\n<<<<<<< SEARCH\nx\n=======\ny\n>>>>>>> REPLACE\n</edit>',
    ]
    for c in chunks:
        for e in p.process_chunk(c):
            if e["type"] == "chat":
                chat += e["text"]
    chat += "".join(e["text"] for e in p.flush() if e["type"] == "chat")
    assert "<" not in chat  # 부분 태그가 새지 않음
    assert p.get_patch().startswith("<edit")


# ── 마크다운 펜스 누출 (```xml 등이 답변에 남는 문제) ──────────────────


def test_diff_fence_wrapping_patch_is_not_leaked_to_chat():
    """모델이 <edit> 를 ```xml 로 감싸면 여는 펜스만 chat 에 남는다 → 제거해야 한다.

    닫는 펜스는 patch_buffer 로 삼켜져 답변 끝에 "```xml" 만 덩그러니 노출된다.
    """
    p = StreamingParser(mode="diff")
    events = _feed(p, "버튼 영역을 삭제하였습니다.\n\n```xml\n" + PATCH + "\n```\n")
    chat_text = "".join(e["text"] for e in events if e["type"] == "chat")

    assert "삭제하였습니다" in chat_text
    assert "```" not in chat_text, f"펜스가 답변에 남았다: {chat_text!r}"


def test_file_fence_wrapping_code_is_not_leaked_to_chat():
    """전체출력 모드에서 ```tsx 로 <file> 을 감싼 경우도 동일하게 제거."""
    p = StreamingParser(mode="file")
    body = '<file path="src/A.tsx">const A = () => null;\nexport default A;</file>'
    events = _feed(p, "로그인 폼입니다.\n\n```tsx\n" + body + "\n```\n")
    chat_text = "".join(e["text"] for e in events if e["type"] == "chat")

    assert "로그인 폼입니다" in chat_text
    assert "```" not in chat_text, f"펜스가 답변에 남았다: {chat_text!r}"


def test_closed_fence_in_explanation_is_preserved():
    """설명 안의 정상적인(열고 닫은) 코드 펜스는 건드리지 않는다."""
    p = StreamingParser(mode="diff")
    prose = "이렇게 씁니다:\n\n```\nconst x = 1;\n```\n\n적용했습니다.\n"
    events = _feed(p, prose + PATCH)
    chat_text = "".join(e["text"] for e in events if e["type"] == "chat")

    assert chat_text.count("```") == 2, f"정상 펜스가 사라졌다: {chat_text!r}"
