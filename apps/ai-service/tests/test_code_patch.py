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
