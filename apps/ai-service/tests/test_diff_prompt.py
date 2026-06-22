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
