"""diff 패치 파싱/적용 단위 테스트 (순수 함수, 외부 의존 없음)."""
import pytest

from app.services.code_patch import PatchError, apply_edits, parse_edits

EDIT = """\
<edit path="src/A.tsx">
<<<<<<< SEARCH
const x = 1;
=======
const x = 2;
>>>>>>> REPLACE
</edit>"""


def test_parse_single_block():
    edits = parse_edits("설명입니다.\n" + EDIT)
    assert edits == [("const x = 1;", "const x = 2;")]


def test_parse_multiple_blocks():
    two = EDIT + "\n" + EDIT.replace("x = 1", "y = 1").replace("x = 2", "y = 2")
    edits = parse_edits(two)
    assert len(edits) == 2
    assert edits[1] == ("const y = 1;", "const y = 2;")


def test_parse_empty_replace_allowed():
    block = (
        '<edit path="src/A.tsx">\n<<<<<<< SEARCH\nconst x = 1;\n'
        "=======\n>>>>>>> REPLACE\n</edit>"
    )
    assert parse_edits(block) == [("const x = 1;", "")]


def test_parse_no_edit_tag_raises():
    with pytest.raises(PatchError):
        parse_edits("그냥 설명만 있고 edit 블록 없음")


def test_parse_malformed_missing_separator_raises():
    bad = '<edit path="src/A.tsx">\n<<<<<<< SEARCH\nconst x = 1;\n>>>>>>> REPLACE\n</edit>'
    with pytest.raises(PatchError):
        parse_edits(bad)


def test_parse_incomplete_block_raises():
    bad = '<edit path="src/A.tsx">\n<<<<<<< SEARCH\nconst x = 1;\n======='
    with pytest.raises(PatchError):
        parse_edits(bad)


BASE = "const x = 1;\nconst y = 2;\nconsole.log(x, y);\n"


def test_apply_exact_single():
    out = apply_edits(BASE, [("const x = 1;", "const x = 9;")])
    assert "const x = 9;" in out and "const y = 2;" in out


def test_apply_fuzzy_trailing_whitespace():
    out = apply_edits(BASE, [("const x = 1;   ", "const x = 9;")])
    assert "const x = 9;" in out


def test_apply_sequential_two_edits():
    out = apply_edits(BASE, [("const x = 1;", "const x = 9;"), ("const y = 2;", "const y = 8;")])
    assert "const x = 9;" in out and "const y = 8;" in out


def test_apply_search_not_found_raises():
    with pytest.raises(PatchError):
        apply_edits(BASE, [("const z = 3;", "const z = 4;")])


def test_apply_ambiguous_search_raises():
    base = "a();\na();\n"
    with pytest.raises(PatchError):
        apply_edits(base, [("a();", "b();")])


def test_apply_later_edit_targets_removed_region_raises():
    edits = [("const x = 1;", "const x = 9;"), ("const x = 1;", "const x = 7;")]
    with pytest.raises(PatchError):
        apply_edits(BASE, edits)


def test_apply_indentation_preserved_internal_whitespace():
    base = "function f() {\n  return 1;\n}\n"
    out = apply_edits(base, [("  return 1;", "  return 2;")])
    assert "  return 2;" in out
