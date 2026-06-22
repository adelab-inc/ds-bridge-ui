"""diff 모드 프롬프트 분기 테스트."""
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
