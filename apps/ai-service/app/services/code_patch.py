"""diff(search/replace) 패치 파싱 및 적용 — 순수 함수, 외부 의존 없음.

모델이 <edit> search/replace 블록을 출력하면 parse_edits로 (search, replace)
목록을 만들고, apply_edits로 현재 파일에 순차 적용해 전체 파일을 만든다.
"""
import re

__all__ = ["PatchError", "parse_edits", "apply_edits"]


class PatchError(Exception):
    """패치 파싱/적용 실패. 호출부는 이를 받아 전체출력 재생성으로 폴백한다."""


# <edit ...> <<<<<<< SEARCH \n {search} \n ======= \n {replace} \n >>>>>>> REPLACE </edit>
_EDIT_BLOCK = re.compile(
    r"<edit\b[^>]*>\s*"
    r"<{7}\s*SEARCH\s*\n"
    r"(?P<search>.*?)"
    r"\n?={7}[ \t]*\n"
    r"(?P<replace>.*?)"
    r"\n?>{7}\s*REPLACE\s*"
    r"</edit>",
    re.DOTALL,
)
# 블록처럼 보이지만 마커가 깨진 경우 감지용
_EDIT_OPEN = re.compile(r"<edit\b[^>]*>", re.DOTALL)


def parse_edits(text: str) -> list[tuple[str, str]]:
    """text에서 모든 <edit> 블록을 (search, replace) 목록으로 파싱.

    - 정상 블록 0개이고 <edit 흔적이 있거나, 전혀 없으면 PatchError.
    - <edit 열림 수와 정상 블록 수가 다르면(마커 깨짐) PatchError.
    """
    text = text.replace("\r\n", "\n")
    blocks = [(m.group("search"), m.group("replace")) for m in _EDIT_BLOCK.finditer(text)]
    opens = len(_EDIT_OPEN.findall(text))
    if not blocks:
        raise PatchError("no valid <edit> block found")
    if opens != len(blocks):
        raise PatchError(f"malformed edit block: {opens} <edit> open(s) but {len(blocks)} parsed")
    return blocks


def apply_edits(base: str, edits: list[tuple[str, str]]) -> str:
    """edits를 base에 순차 적용해 전체 파일 문자열 반환.

    각 (search, replace):
      1) 정확 매칭이 유일하면 치환.
      2) 아니면 퍼지 매칭(줄 trailing 공백 무시)이 유일하면 그 줄 범위를 치환.
      3) 둘 다 유일 매칭 실패면 PatchError.
    개행은 \n으로 정규화한 위에서 작업한다.
    """
    if not edits:
        raise PatchError("empty edit list")
    result = base.replace("\r\n", "\n")
    for search, replace in edits:
        search = search.replace("\r\n", "\n")
        replace = replace.replace("\r\n", "\n")
        if search == "":
            raise PatchError("empty SEARCH block")
        if result.count(search) == 1:
            result = result.replace(search, replace, 1)
            continue
        span = _fuzzy_find_unique(result, search)
        if span is None:
            raise PatchError(f"SEARCH not uniquely found: {search[:120]!r}")
        start, end = span
        result = result[:start] + replace + result[end:]
    return result


def _fuzzy_find_unique(text: str, search: str) -> tuple[int, int] | None:
    """줄 단위 비교(각 줄 trailing 공백 제거, 줄 내부 공백 보존)로 search가
    text에서 정확히 1회 매칭되는 char 범위 (start, end)를 반환. 0개/복수면 None.
    text, search는 개행이 \n으로 정규화되어 있다고 가정한다.
    """
    text_lines = text.split("\n")
    search_lines = [ln.rstrip() for ln in search.split("\n")]
    while search_lines and search_lines[-1] == "":
        search_lines.pop()
    if not search_lines:
        return None
    norm = [ln.rstrip() for ln in text_lines]
    n = len(search_lines)
    matches = [i for i in range(len(norm) - n + 1) if norm[i : i + n] == search_lines]
    if len(matches) != 1:
        return None
    i = matches[0]
    start = sum(len(ln) + 1 for ln in text_lines[:i])
    region_len = sum(len(ln) for ln in text_lines[i : i + n]) + (n - 1)
    return (start, start + region_len)
