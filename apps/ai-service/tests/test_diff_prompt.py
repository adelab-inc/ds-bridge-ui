"""diff 모드 프롬프트 분기 테스트."""
import app.api.chat as chat_module
from app.api.components import (
    DIFF_RESPONSE_FORMAT_INSTRUCTIONS,
    RESPONSE_FORMAT_INSTRUCTIONS,
    generate_system_prompt,
)


def _schema():
    return {"components": {}}


def test_diff_format_instructions_mention_edit_blocks():
    assert "<edit" in DIFF_RESPONSE_FORMAT_INSTRUCTIONS
    assert "SEARCH" in DIFF_RESPONSE_FORMAT_INSTRUCTIONS
    assert "REPLACE" in DIFF_RESPONSE_FORMAT_INSTRUCTIONS


def test_generate_system_prompt_full_uses_file_format():
    p = generate_system_prompt(_schema())
    assert RESPONSE_FORMAT_INSTRUCTIONS.strip()[:40] in p
    assert DIFF_RESPONSE_FORMAT_INSTRUCTIONS not in p


def test_generate_system_prompt_diff_uses_edit_format():
    p = generate_system_prompt(_schema(), diff_mode=True)
    assert DIFF_RESPONSE_FORMAT_INSTRUCTIONS in p
    assert RESPONSE_FORMAT_INSTRUCTIONS not in p


async def test_build_history_diff_uses_edit_instruction():
    base = {"path": "src/A.tsx", "content": "const x = 1;"}
    msgs = await chat_module.build_conversation_history(
        room_id="r1", system_prompt="SYS", current_message="x를 2로",
        base_code=base, diff_mode=True,
    )
    user = msgs[-1].content
    assert "현재 코드:" in user and "src/A.tsx" in user
    assert "<edit" in user or "SEARCH" in user
    assert "전체 코드를 빠짐없이 출력" not in user


async def test_build_history_full_uses_file_instruction():
    base = {"path": "src/A.tsx", "content": "const x = 1;"}
    msgs = await chat_module.build_conversation_history(
        room_id="r1", system_prompt="SYS", current_message="x를 2로",
        base_code=base, diff_mode=False,
    )
    user = msgs[-1].content
    assert "전체 코드를 빠짐없이 출력" in user


def test_diff_example_is_not_wrapped_in_markdown_fence():
    """예시를 ``` 로 감싸면 모델이 그대로 흉내내 답변에 펜스가 새어 나온다.

    실측: 최근 답변 600건 중 43건(7.2%)에서 '```xml' 등이 답변 끝에 남았다.
    """
    example = DIFF_RESPONSE_FORMAT_INSTRUCTIONS.split("### 규칙")[0]
    assert "<edit path=" in example, "예시는 있어야 함"
    assert "```" not in example, f"예시가 펜스로 감싸여 있다:\n{example}"


def test_diff_rules_require_explanation_before_edit_block():
    """설명 생략 시 채팅이 비어 보인다 — FORMAT 목록이 아니라 '규칙' 블록에서 강제한다."""
    rules = DIFF_RESPONSE_FORMAT_INSTRUCTIONS.split("### 규칙")[1]

    assert "설명" in rules
    assert "생략" in rules


def test_diff_rules_cap_search_block_scope():
    """SEARCH 범위가 과하면 요청하지 않은 코드까지 재작성되며 사라진다.

    실측(room 02fa4dd0, 09-03 11:36): "컬럼 2개 삭제" 요청에 edits=3 으로
    537줄이 교체되며 ActionBar·삭제 확인 Dialog 등이 함께 사라졌다.
    """
    rules = DIFF_RESPONSE_FORMAT_INSTRUCTIONS.split("### 규칙")[1]

    assert "최소" in rules, "SEARCH 최소 범위 규칙이 없음"
    assert "삭제" in rules, "요청에 없는 코드 삭제 금지 규칙이 없음"
