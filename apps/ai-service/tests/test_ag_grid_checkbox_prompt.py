"""AG Grid 체크박스 토글(선택모드 ON/OFF) 프롬프트 규칙.

배경: `checkboxes: false` 만 주면 AG Grid 34.2 는 `headerCheckbox ?? true` 때문에
selection 컬럼을 이미 만들어 두고, 나중에 `checkboxes: true` 로 바꿔도 셀을
재생성하지 않아 바디 체크박스가 렌더되지 않는다(번들 실측 확인).
→ `checkboxes: false` 는 항상 `headerCheckbox: false` 와 짝으로 쓴다.

핸드오프: ai-prompt-datagrid-checkbox-toggle-handoff-2026-08-19.md §4
"""

import re

from app.api.components import format_ag_grid_component_docs, get_system_prompt


# AG Grid 문서는 스키마가 있을 때만 생성된다(정적 SYSTEM_PROMPT 에는 포함되지 않음)
_AG_GRID_SCHEMA = {
    "description": "AG Grid DataGrid",
    "props": {"rowData": {"type": "any[]"}, "columnDefs": {"type": "ColDef[]"}},
}


def _docs() -> str:
    return format_ag_grid_component_docs(_AG_GRID_SCHEMA)


def test_row_click_selection_example_disables_both_checkbox_flags() -> None:
    """'체크박스 없이 행 클릭 선택' 예시는 기본값 때문에 실제로는 체크박스가 떴다."""
    docs = _docs()

    assert "rowSelection={{ mode: 'multiRow', enableClickSelection: true }}" not in docs
    assert (
        "rowSelection={{ mode: 'multiRow', checkboxes: false, headerCheckbox: false, "
        "enableClickSelection: true }}" in docs
    )


def test_toggle_pattern_example_exists_with_both_branches() -> None:
    """버튼으로 선택모드를 켜고 끄는 패턴 예시 — OFF 분기에 headerCheckbox: false 필수."""
    docs = _docs()

    assert "isDeleteMode" in docs, "토글 패턴 예시가 없음"
    assert "checkboxes: true, headerCheckbox: true, enableClickSelection: true" in docs
    assert "checkboxes: false, headerCheckbox: false, enableClickSelection: false" in docs


def test_rule_explains_why_header_checkbox_must_be_false() -> None:
    docs = _docs()

    assert "headerCheckbox` 기본값이 `true`" in docs
    assert "재생성" in docs, "왜 바디 체크박스가 안 뜨는지 이유가 없음"


def test_final_verification_has_checkbox_pair_item_and_contiguous_numbers() -> None:
    """Final Verification 에 항목 추가 후에도 번호가 1..N 연속이어야 한다."""
    prompt = get_system_prompt()
    section = prompt.split("## Final Verification")[1].split("\n## ")[0]
    numbers = [int(m.group(1)) for m in re.finditer(r"^(\d+)\.", section, re.M)]

    assert numbers == list(range(1, len(numbers) + 1)), f"번호가 끊김: {numbers}"
    assert any("headerCheckbox: false" in line for line in section.splitlines()), (
        "checkboxes:false ↔ headerCheckbox:false 짝 검증 항목이 없음"
    )


def test_prompt_mentions_header_checkbox_false_at_least_three_times() -> None:
    """예시 2곳 + 규칙 문장 (핸드오프 §5-1).

    단 §5-1 은 `get_system_prompt()` 기준으로 세라고 했는데, AG Grid 문서는 스키마 기반
    동적 생성이라 정적 프롬프트에 없다. 실제 카운트 대상은 AG Grid 문서 쪽이다.
    """
    assert _docs().count("headerCheckbox: false") >= 3
    # 정적 프롬프트에는 Final Verification 항목으로 최소 1회
    assert get_system_prompt().count("headerCheckbox: false") >= 1
