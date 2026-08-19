"""JSX 태그 균형 검사 — 실제 DB에서 뽑은 픽스처 기반.

참값: apps/web 의 typescript 파서(`ts.createSourceFile` + parseDiagnostics).
핸드오프 문서: ai-service-jsx-balance-validation-handoff-2026-08-19.md
"""

from pathlib import Path

from app.services.code_validator import (
    scan_generated_code_defects,
    scan_jsx_balance,
    scan_patch_markers,
)

FIXTURES = Path(__file__).parent / "fixtures" / "jsx_balance"


def _fixture(name: str) -> str:
    return (FIXTURES / name).read_text()


def test_detects_drawer_closed_by_div() -> None:
    """#54: 페이지 최상위 <div>를 <Drawer>로 바꾸며 끝의 </div>를 남긴 케이스."""
    errors = scan_jsx_balance(_fixture("bad_54_0bee2018_drawer_closed_by_div.tsx"))

    assert errors, "태그 불균형을 감지해야 함"
    assert errors[0].category == "jsx_unbalanced"
    assert "Drawer" in errors[0].message
    assert "div" in errors[0].message


def test_reports_leftover_search_replace_markers() -> None:
    """room 763eef53: SEARCH/REPLACE 마커가 저장된 코드에 그대로 남은 케이스."""
    errors = scan_patch_markers(_fixture("bad_merge_marker_e64fd11b.tsx"))

    assert [e.category for e in errors] == ["patch_marker_leak"] * len(errors)
    assert len(errors) == 3, "마커 3줄(REPLACE/SEARCH/=======)을 모두 보고해야 함"
    assert "line 39" in errors[1].location


# ── 오탐 방지: 태그가 아닌 `<`/`>` 를 태그로 세지 않아야 한다 ──────────────


def test_arrow_function_in_prop_is_not_a_tag() -> None:
    source = """
    export const A = () => (
      <div>
        <Button onClick={() => setOpen(a > b)}>확인</Button>
      </div>
    );
    """
    assert scan_jsx_balance(source) == []


def test_generic_type_argument_is_not_a_tag() -> None:
    source = """
    export const A = () => {
      const [items, setItems] = useState<string[]>([]);
      const map: Record<string, number> = {};
      const rows = new Array<string>();
      return <div>{items.length + Object.keys(map).length + rows.length}</div>;
    };
    """
    assert scan_jsx_balance(source) == []


def test_greater_than_in_text_and_string_is_not_a_tag() -> None:
    source = """
    export const A = () => (
      <div>
        {'>'} 다음 단계 {"<"}
        <span>a &gt; b</span>
      </div>
    );
    """
    assert scan_jsx_balance(source) == []


def test_fragment_shorthand_is_balanced() -> None:
    source = """
    export const A = () => (
      <>
        <Drawer>본문</Drawer>
        <Dialog>팝업</Dialog>
      </>
    );
    """
    assert scan_jsx_balance(source) == []


def test_dotted_component_name_is_balanced() -> None:
    source = """
    export const A = () => (
      <Drawer>
        <Drawer.Header title="제목" />
        <Drawer.Body>본문</Drawer.Body>
      </Drawer>
    );
    """
    assert scan_jsx_balance(source) == []


def test_multiline_self_closing_tag_is_not_left_open() -> None:
    source = """
    export const A = () => (
      <FormGrid>
        <Radio
          value="a"
          checked={value === 'a'}
          onChange={(e) => setValue(e.target.value)}
        />
      </FormGrid>
    );
    """
    assert scan_jsx_balance(source) == []


def test_combined_scan_reports_marker_and_balance_defects() -> None:
    """chat.py 게이트가 쓰는 단일 진입점 — 마커 잔존과 태그 불균형을 함께 보고한다."""
    errors = scan_generated_code_defects(_fixture("bad_merge_marker_e64fd11b.tsx"))

    assert {e.category for e in errors} == {"patch_marker_leak", "jsx_unbalanced"}


def test_combined_scan_is_empty_for_healthy_code() -> None:
    assert scan_generated_code_defects(_fixture("ok_53_67dd47b0_pre_drawer.tsx")) == []
