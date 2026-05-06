import asyncio
import json
import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.api.components import (
    generate_system_prompt,
    get_vision_system_prompt,
)
from app.core.auth import verify_api_key
from app.core.config import get_settings
from app.schemas.chat import (
    BroadcastResponse,
    ChatRequest,
    ChatResponse,
    CurrentComposition,
    FileContent,
    ImageContent,
    Message,
    ParsedResponse,
)
from app.schemas.validation import ValidationError, ValidationReport
from app.services.ai_provider import AIProvider, get_ai_provider
from app.services.broadcast import broadcast_event, track_broadcast_task
from app.services.message_condenser import condense_message
from app.services.code_validator import ComponentCatalog, validate_code
from app.services.figma_api import FigmaRateLimitError, extract_figma_url
from app.services.supabase_db import (
    DatabaseError,
    RoomNotFoundError,
    create_chat_message,
    get_chat_room,
    get_latest_code_message,
    get_message_by_id,
    get_timestamp_ms,
    update_chat_message,
)
from app.services.supabase_storage import (
    DEFAULT_AG_GRID_SCHEMA_KEY,
    DEFAULT_SCHEMA_KEY,
    fetch_ag_grid_tokens_from_storage,
    fetch_component_definitions_from_storage,
    fetch_component_usage_map,
    fetch_design_tokens_from_storage,
    fetch_image_as_base64,
    fetch_schema_from_storage,
)
from app.services.tool_calling_loop import run_figma_tool_calling_loop

# Validator 싱글턴 (모듈 import 시 1회 로드)
_CODE_CATALOG = ComponentCatalog.load_default()


async def _maybe_validate_and_repair(parsed: ParsedResponse, provider: object) -> None:
    """ENABLE_VALIDATION이 켜져 있으면 parsed.files를 검증하고,
    ENABLE_REPAIR까지 켜져 있으면 AI 수정을 시도한다.

    여러 파일이 있어도 모두 검증하며, errors/elapsed_ms는 합산한다.
    repair 성공 시 parsed.files와 parsed.validation을 교체한다.
    """
    settings = get_settings()
    if not settings.enable_validation or not parsed.files:
        return

    # 1. 검증
    merged_errors: list[ValidationError] = []
    merged_warnings: list[ValidationError] = []
    elapsed_total = 0
    for f in parsed.files:
        report = validate_code(f.content, _CODE_CATALOG)
        for err in report.errors:
            err.location = f"{f.path}: {err.location}"
        for warn in report.warnings:
            warn.location = f"{f.path}: {warn.location}"
        merged_errors.extend(report.errors)
        merged_warnings.extend(report.warnings)
        elapsed_total += report.elapsed_ms

    merged_report = ValidationReport(
        passed=not merged_errors,
        errors=merged_errors,
        warnings=merged_warnings,
        elapsed_ms=elapsed_total,
    )

    # 2. 검증 통과 또는 repair 비활성 → 리포트만 설정
    if merged_report.passed or not settings.enable_repair:
        parsed.validation = merged_report
        return

    # 3. Repair 시도
    from app.services.repair_loop import repair_code

    result = await repair_code(parsed.files, merged_report, provider, _CODE_CATALOG)
    if result.success:
        parsed.files = result.files
        parsed.validation = result.report
    else:
        parsed.validation = merged_report


def _build_done_validation_payload(collected_files: list[dict]) -> dict:
    """스트리밍 `done` 이벤트에 첨부할 검증 리포트 딕셔너리를 만든다.

    ENABLE_VALIDATION=false 이거나 생성 파일이 없으면 빈 dict를 반환해
    기존 페이로드 형식을 유지한다.
    """
    settings = get_settings()
    if not settings.enable_validation or not collected_files:
        return {}

    merged_errors: list[ValidationError] = []
    merged_warnings: list[ValidationError] = []
    elapsed_total = 0
    for f in collected_files:
        content = f.get("content", "")
        if not content:
            continue
        report = validate_code(content, _CODE_CATALOG)
        merged_errors.extend(report.errors)
        merged_warnings.extend(report.warnings)
        elapsed_total += report.elapsed_ms

    report_obj = ValidationReport(
        passed=not merged_errors,
        errors=merged_errors,
        warnings=merged_warnings,
        elapsed_ms=elapsed_total,
    )
    return {"validation": report_obj.model_dump()}


router = APIRouter(dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)


# ============================================================================
# System Prompt Helper
# ============================================================================


def build_instance_edit_context(
    composition: CurrentComposition,
    selected_id: str,
) -> str:
    """
    선택된 인스턴스 편집을 위한 컨텍스트 생성

    Args:
        composition: 현재 렌더링된 컴포넌트 구조
        selected_id: 선택된 인스턴스 ID

    Returns:
        인스턴스 편집 모드 컨텍스트 문자열
    """
    # 선택된 인스턴스 찾기
    selected = None
    for instance in composition.instances:
        if instance.id == selected_id:
            selected = instance
            break

    if not selected:
        return ""

    # composition을 dict로 변환
    composition_dict = {
        "instances": [
            {"id": inst.id, "component": inst.component, "props": inst.props}
            for inst in composition.instances
        ]
    }

    return f"""

## INSTANCE EDIT MODE (인스턴스 편집 모드)

사용자가 특정 컴포넌트 인스턴스를 선택했습니다. 해당 인스턴스만 수정하세요.

### 선택된 인스턴스
- **ID**: {selected.id}
- **Component**: {selected.component}
- **Current Props**:
```json
{json.dumps(selected.props, indent=2, ensure_ascii=False)}
```

### 전체 Composition (현재 화면 상태)
```json
{json.dumps(composition_dict, indent=2, ensure_ascii=False)}
```

### 인스턴스 편집 규칙 (CRITICAL)

1. **수정 범위**: 선택된 인스턴스({selected.id})의 props만 수정
2. **원본 보존**: 컴포넌트 정의(스키마)는 절대 변경 금지
3. **다른 인스턴스**: 다른 인스턴스는 변경하지 않음
4. **응답 형식**: 전체 코드를 다시 생성하되, 선택된 인스턴스의 props만 변경
5. **NO IMPORTS**: import 문을 절대 사용하지 마세요. React.useState, React.useEffect 등 직접 사용

예시) "배경색 파란색으로" 요청 시:
- 변경 전: `<Button data-instance-id="{selected.id}" variant="primary">로그인</Button>`
- 변경 후: `<Button data-instance-id="{selected.id}" variant="primary" className="bg-blue-500">로그인</Button>`

사용자의 요청에 따라 선택된 인스턴스({selected.id})만 수정하세요.
"""






async def resolve_system_prompt(
    schema_key: str | None,
    current_composition: CurrentComposition | None = None,
    selected_instance_id: str | None = None,
    *,
    skip_ui_patterns: bool = False,
) -> str:
    """
    schema_key 여부에 따라 시스템 프롬프트 반환 (데이터 병렬 로드)

    Args:
        schema_key: Firebase Storage 스키마 경로 (None이면 디폴트 경로 사용)
        current_composition: 현재 렌더링된 컴포넌트 구조 (인스턴스 편집용)
        selected_instance_id: 선택된 인스턴스 ID (인스턴스 편집용)
        skip_ui_patterns: True이면 UI_PATTERN_EXAMPLES 제외 (Figma 모드 등 도메인 예시 오염 방지)

    Returns:
        시스템 프롬프트 문자열
    """
    effective_key = schema_key or DEFAULT_SCHEMA_KEY

    # 모든 Supabase 데이터를 병렬 로드
    results = await asyncio.gather(
        fetch_design_tokens_from_storage(),
        fetch_schema_from_storage(DEFAULT_AG_GRID_SCHEMA_KEY),
        fetch_ag_grid_tokens_from_storage(),
        fetch_component_definitions_from_storage(),
        fetch_schema_from_storage(effective_key),
        fetch_component_usage_map(),
        return_exceptions=True,
    )

    design_tokens = results[0] if not isinstance(results[0], Exception) else None
    ag_grid_schema = results[1] if not isinstance(results[1], Exception) else None
    ag_grid_tokens = results[2] if not isinstance(results[2], Exception) else None
    component_definitions = results[3] if not isinstance(results[3], Exception) else None
    schema = results[4]
    component_usage_map = results[5] if not isinstance(results[5], Exception) else None

    if isinstance(schema, Exception):
        if isinstance(schema, FileNotFoundError):
            logger.warning("Schema not found in storage", extra={"schema_key": effective_key})
            raise HTTPException(status_code=404, detail=f"Schema not found: {effective_key}")
        logger.error("Failed to fetch schema", extra={"schema_key": effective_key, "error": str(schema)})
        raise HTTPException(
            status_code=500, detail="Failed to load schema from storage. Please try again."
        )

    base_prompt = generate_system_prompt(
        schema, design_tokens, ag_grid_schema, ag_grid_tokens, component_definitions,
        skip_ui_patterns=skip_ui_patterns,
        component_usage_map=component_usage_map,
    )

    # 인스턴스 편집 모드면 컨텍스트 추가
    if current_composition and selected_instance_id:
        instance_context = build_instance_edit_context(
            current_composition,
            selected_instance_id,
        )
        base_prompt += instance_context

    return base_prompt


async def build_conversation_history(
    room_id: str,
    system_prompt: str,
    current_message: str,
    from_message_id: str | None = None,
) -> list[Message]:
    """
    코드 기반 컨텍스트로 메시지 리스트 생성 (대화 히스토리 제거)

    전략: "코드가 곧 컨텍스트"
    - 이전 대화 히스토리를 넣지 않고, 최신 코드 + 현재 요청만 전달
    - 오래된 코드 버전에 의한 컨텍스트 오염 방지
    - 단계별 빌드(레이아웃 → 버튼 → 세부사항) 시 일관성 유지

    Args:
        room_id: 채팅방 ID
        system_prompt: 시스템 프롬프트
        current_message: 현재 사용자 메시지
        from_message_id: 특정 메시지의 코드를 기준으로 수정

    Returns:
        AI에 전달할 메시지 리스트
    """
    messages = [Message(role="system", content=system_prompt)]

    # 기준 코드 결정: from_message_id > 방의 마지막 메시지 코드
    base_code: dict | None = None

    if from_message_id:
        # 명시적 기준 메시지 지정
        base_message = await get_message_by_id(from_message_id)
        if base_message is None:
            raise ValueError(f"Message not found: {from_message_id}")
        if base_message.get("content"):
            base_code = {
                "path": base_message.get("path", "src/Component.tsx"),
                "content": base_message["content"],
            }
            logger.info(
                "Code context from specified message",
                extra={"from_message_id": from_message_id, "path": base_code["path"]},
            )
    else:
        # 방의 최신 코드 메시지 1건만 조회 (최적화)
        latest_code_msg = await get_latest_code_message(room_id)
        if latest_code_msg and latest_code_msg.get("content") and latest_code_msg.get("path"):
            base_code = {
                "path": latest_code_msg["path"],
                "content": latest_code_msg["content"],
            }
            logger.info(
                "Code context from latest message",
                extra={"room_id": room_id, "path": base_code["path"]},
            )

    # 사용자 메시지 구성: 기존 코드가 있으면 포함
    if base_code:
        final_message = f'''현재 코드:
<file path="{base_code["path"]}">{base_code["content"]}</file>

요청: {current_message}

⚠️ 수정 규칙 (절대 준수):
- 위 요청에 해당하는 부분만 정확히 수정할 것
- 요청과 무관한 텍스트, 색상, 레이아웃, 스타일, 컴포넌트 구조는 절대 변경하지 말 것
- 변수명, 함수명, import, 더미 데이터도 기존 그대로 유지할 것
- 기존에 없던 UI 요소(타이틀, 필터, 안내문 등)를 임의로 추가하지 말 것
- 전체 코드를 빠짐없이 출력할 것 (생략 시 빈 화면 발생)
- 수정 전후 diff가 요청 범위 안에서만 발생해야 함'''
    else:
        # 첫 메시지 — 코드 없이 요청만 (긴 메시지는 경량 모델로 압축)
        processed = await condense_message(current_message)
        final_message = processed

        # 완성도 리마인더: 첫 생성 시에만 추가 (수정 경로에서는 "요청 외 변경 금지"와 충돌)
        final_message += (
            "\n\n⚠️ 완성도 필수: 위 요청에 명시된 그리드 컬럼, 드롭다운 옵션, "
            "다이얼로그를 전부 구현하세요. 조건부 활성/비활성 컬럼이나 "
            "단순 텍스트 입력 컬럼도 빠짐없이 columnDefs에 포함하세요. "
            "코드 출력 전 요청된 컬럼 수와 columnDefs 항목 수가 일치하는지 "
            "반드시 세어보고, 누락이 있으면 추가한 뒤 출력하세요."
        )

    messages.append(Message(role="user", content=final_message))

    return messages


# ============================================================================
# Response Parsing Utilities
# ============================================================================

FILE_TAG_PATTERN = re.compile(r'<file\s+path="([^"]+)">([\s\S]*?)</file>')

# Fallback: 마크다운 코드블록 (```tsx ... ``` 또는 ```typescript ... ```)
_MARKDOWN_CODE_PATTERN = re.compile(r'```(?:tsx|typescript|jsx)\s*\n([\s\S]*?)```')

# 코드 첫 줄 경로 주석 패턴: // src/pages/Xxx.tsx
_PATH_COMMENT_PATTERN = re.compile(r'^//\s*(src/\S+\.tsx)\s*$', re.MULTILINE)


def _extract_path_hint(code: str) -> str:
    """코드에서 파일 경로 힌트를 추출한다. 없으면 기본값 반환."""
    match = _PATH_COMMENT_PATTERN.search(code)
    if match:
        return match.group(1)
    return "src/pages/GeneratedComponent.tsx"

# Icon size별 사용 가능한 이름 (존재하지 않는 조합 보정용)
_ICON_NAMES_BY_SIZE: dict[int, set[str]] = {
    16: {"add", "announcement", "blank", "calendar", "check", "chevron-down", "chevron-left", "chevron-right", "chevron-up", "close", "delete", "dot", "edit", "external", "loading", "minus", "more-vert", "reset", "search", "star-fill", "star-line"},
    18: {"add", "chevron-down", "chevron-left", "chevron-right", "chevron-up", "dummy"},
    20: {"add", "all", "arrow-drop-down", "arrow-drop-up", "arrow-right", "blank", "calendar", "check", "chevron-down", "chevron-left", "chevron-right", "chevron-up", "close", "delete", "dot", "edit", "error", "external", "filter-list", "folder", "folder-fill", "format-align-center", "format-align-left", "format-align-right", "format-bold", "format-color-text", "format-color-text-bg", "format-italic", "format-list-bulleted", "format-list-numbered", "format-underlined", "help", "image", "info", "keyboard-arrow-left", "keyboard-arrow-right", "keyboard-double-arrow-left", "keyboard-double-arrow-right", "link", "loading", "menu", "minus", "more-vert", "person", "post", "redo", "reset", "search", "star-fill", "star-line", "success", "table", "undo", "video", "warning", "widgets"},
    24: {"add", "all", "arrow-drop-down", "arrow-drop-up", "blank", "chevron-down", "chevron-left", "chevron-right", "close", "dehaze", "delete", "edit", "filter-list", "loading", "menu", "more-vert", "person", "post", "search", "star-fill", "star-line", "widgets"},
}
_ICON_TAG_PATTERN = re.compile(r'<Icon\s+name="([^"]+)"\s+size=\{(\d+)\}\s*/?\s*>')


def _fix_icon_sizes(content: str) -> str:
    """존재하지 않는 Icon name+size 조합을 유효한 size로 교정한다."""

    def _replace(m: re.Match[str]) -> str:
        name = m.group(1)
        size = int(m.group(2))
        available = _ICON_NAMES_BY_SIZE.get(size)
        if available and name in available:
            return m.group(0)  # 유효한 조합 — 그대로
        # 해당 size에 없으면 → size 20(가장 많은 아이콘)으로 변경
        if name in _ICON_NAMES_BY_SIZE[20]:
            return f'<Icon name="{name}" size={{20}} />'
        # size 20에도 없으면 → 다른 size에서 찾기
        for fallback_size in (16, 24):
            if name in _ICON_NAMES_BY_SIZE.get(fallback_size, set()):
                return f'<Icon name="{name}" size={{{fallback_size}}} />'
        return m.group(0)  # 어디에도 없으면 원본 유지

    return _ICON_TAG_PATTERN.sub(_replace, content)


def _fix_button_icon_crash(content: str) -> str:
    """Button/IconButton의 size prop이 icon size를 강제 변환하여 발생하는 CRASH를 교정한다.

    Button:     sm→16, md→16, lg→20
    IconButton: sm→16, md→20, lg→24

    아이콘이 해당 size에 없으면 icon이 존재하는 size로 버튼 size를 변경한다.
    """
    # 버튼 size → 내부 icon size 매핑
    _BUTTON_ICON_SIZE = {"sm": 16, "md": 16, "lg": 20}
    _ICONBUTTON_ICON_SIZE = {"sm": 16, "md": 20, "lg": 24}

    # icon size → 필요한 버튼 size (역매핑, size 20 우선)
    _BUTTON_SIZE_FOR_ICON = {20: "lg", 16: "sm"}
    _ICONBUTTON_SIZE_FOR_ICON = {20: "md", 16: "sm", 24: "lg"}

    tag_re = re.compile(
        r'<((?:Icon)?Button)\b((?:[^>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)(/>|>)',
        re.DOTALL,
    )

    def _find_best_size(icon_names: list[str], size_for_icon: dict[int, str]) -> str | None:
        """아이콘들이 모두 존재하는 버튼 size를 찾는다. 없으면 None."""
        # size 20 → 16 → 24 순으로 시도 (size 20이 가장 많은 아이콘 보유)
        for icon_size in (20, 16, 24):
            available = _ICON_NAMES_BY_SIZE.get(icon_size, set())
            if all(name in available for name in icon_names):
                btn_size = size_for_icon.get(icon_size)
                if btn_size:
                    return btn_size
        return None

    def _fix_tag(m: re.Match[str]) -> str:
        tag_name = m.group(1)
        props = m.group(2)
        closing = m.group(3)
        is_icon_button = tag_name == "IconButton"

        # 현재 size 추출
        size_match = re.search(r'\bsize="(sm|md|lg)"', props)
        if not size_match:
            return m.group(0)
        current_size = size_match.group(1)

        # 아이콘 이름 추출
        icon_names = re.findall(
            r'(?:startIcon|endIcon|iconOnly)=\{<Icon\s+name="([^"]+)"', props
        )
        if not icon_names:
            return m.group(0)

        # 현재 size로 강제되는 icon size 확인
        size_map = _ICONBUTTON_ICON_SIZE if is_icon_button else _BUTTON_ICON_SIZE
        forced_icon_size = size_map.get(current_size, 20)
        available = _ICON_NAMES_BY_SIZE.get(forced_icon_size, set())

        # 모든 아이콘이 해당 size에 존재하면 OK
        if all(name in available for name in icon_names):
            return m.group(0)

        # 유효한 버튼 size 찾기
        size_for_icon = _ICONBUTTON_SIZE_FOR_ICON if is_icon_button else _BUTTON_SIZE_FOR_ICON
        best_size = _find_best_size(icon_names, size_for_icon)
        if not best_size or best_size == current_size:
            return m.group(0)

        fixed_props = re.sub(r'\bsize="(?:sm|md|lg)"', f'size="{best_size}"', props)
        return f"<{tag_name}{fixed_props}{closing}"

    return tag_re.sub(_fix_tag, content)


def _fix_viewport_height(content: str) -> str:
    """viewport 기반 고정 높이 클래스를 제거한다.

    앱 공통 레이아웃이 이미 높이 계산을 처리하므로
    페이지 콘텐츠에서 `h-[calc(100vh-...)]`, `h-screen`, `min-h-screen` 등을 쓰면
    2중 계산되어 콘텐츠가 잘리거나 짧아진다.
    """
    # h-[calc(100vh-...)] / min-h-[calc(100vh-...)] / h-[100vh] 등 제거
    content = re.sub(
        r'\s*(?:min-)?h-\[(?:calc\()?100vh[^\]]*\]',
        '',
        content,
    )
    # h-screen, min-h-screen, max-h-screen 제거
    content = re.sub(
        r'\s*(?:min-|max-)?h-screen\b',
        '',
        content,
    )
    # className 내부 여분 공백 정리 (className scope 한정)
    content = re.sub(
        r'className="([^"]*)"',
        lambda m: f'className="{re.sub(r"\s+", " ", m.group(1)).strip()}"',
        content,
    )
    return content


def _normalize_multiline_imports(content: str) -> str:
    """멀티라인 import를 단일 줄로 정규화.

    프론트엔드 srcdoc 프리뷰가 import 문에서 컴포넌트 이름을 추출하여
    전역 매핑(AplusUI.XXX)에 사용하므로, import 자체를 제거하면 안 됨.
    대신 멀티라인 import를 단일 줄로 변환하여 프론트엔드 regex가 파싱 가능하게 함.
    """
    def _flatten(m: re.Match) -> str:
        # 중괄호 내부의 개행/공백을 단일 공백으로
        inner = re.sub(r'\s+', ' ', m.group(0))
        return inner

    return re.sub(
        r'^[ \t]*import\s+\{[^}]*\}\s+from\s+[\'"][^\'"]+[\'"];?',
        _flatten,
        content,
        flags=re.MULTILINE | re.DOTALL,
    )


def _postprocess_code(content: str) -> str:
    """AI 생성 코드의 Icon 관련 오류와 레이아웃 문제를 교정한다."""
    result = _normalize_multiline_imports(content)
    result = _fix_icon_sizes(result)
    result = _fix_button_icon_crash(result)
    result = _fix_viewport_height(result)
    return result


def parse_ai_response(content: str) -> ParsedResponse:
    """
    AI 응답에서 대화 내용과 파일을 분리

    1차: <file path="...">...</file> 태그 추출
    2차 (fallback): 마크다운 코드블록 ```tsx ... ``` 추출
         — Gemini vision 등이 <file> 태그 대신 코드블록으로 응답하는 경우 대응

    Args:
        content: AI 응답 전체 텍스트

    Returns:
        ParsedResponse with conversation and files separated
    """
    files: list[FileContent] = []

    # 1차: <file path="...">...</file> 태그 추출
    for match in FILE_TAG_PATTERN.finditer(content):
        files.append(
            FileContent(
                path=match.group(1),
                content=_postprocess_code(match.group(2).strip()),
            )
        )

    if files:
        # 태그 제거한 나머지 = 대화 내용
        conversation = FILE_TAG_PATTERN.sub("", content).strip()
        return ParsedResponse(
            conversation=conversation,
            files=files,
            raw=content,
        )

    # 2차 fallback: 마크다운 코드블록에서 추출
    for match in _MARKDOWN_CODE_PATTERN.finditer(content):
        code = match.group(1).strip()
        if not code:
            continue
        # 코드 내에서 경로 힌트 추출 시도 (첫 줄 // src/pages/Xxx.tsx 주석)
        path = _extract_path_hint(code)
        files.append(
            FileContent(
                path=path,
                content=_postprocess_code(code),
            )
        )

    if files:
        conversation = _MARKDOWN_CODE_PATTERN.sub("", content).strip()
    else:
        conversation = content.strip()

    return ParsedResponse(
        conversation=conversation,
        files=files,
        raw=content,
    )


class StreamingParser:
    """스트리밍 응답에서 실시간으로 텍스트/코드 분리"""

    # 정규식 패턴 (클래스 수준에서 미리 컴파일)
    FILE_START_PATTERN = re.compile(r'<file\s+path="([^"]+)">')
    FILE_END_PATTERN = re.compile(r"</file>")

    def __init__(self):
        self.buffer = ""
        self.inside_file = False
        self.current_file_path: str | None = None
        self.current_file_content = ""

    def process_chunk(self, chunk: str) -> list[dict]:
        """
        청크 처리 후 이벤트 목록 반환

        Returns:
            List of events: {'type': 'chat'|'code', ...}
        """
        self.buffer += chunk
        events: list[dict] = []

        while True:
            if not self.inside_file:
                # 파일 태그 시작 감지
                start_match = self.FILE_START_PATTERN.search(self.buffer)
                if start_match:
                    # 태그 이전 텍스트 = 대화
                    before_tag = self.buffer[: start_match.start()]
                    if before_tag:
                        events.append({"type": "chat", "text": before_tag})

                    # 파일 모드 시작
                    self.inside_file = True
                    self.current_file_path = start_match.group(1)
                    self.current_file_content = ""
                    self.buffer = self.buffer[start_match.end() :]
                else:
                    # < 가 있으면 태그 시작일 수 있으므로 그 이전까지만 전송
                    tag_start = self.buffer.rfind("<")
                    if tag_start > 0:
                        events.append({"type": "chat", "text": self.buffer[:tag_start]})
                        self.buffer = self.buffer[tag_start:]
                    elif tag_start == -1 and self.buffer:
                        # < 가 없으면 전체를 대화로 즉시 전송
                        events.append({"type": "chat", "text": self.buffer})
                        self.buffer = ""
                    break
            else:
                # 파일 태그 종료 감지
                end_match = self.FILE_END_PATTERN.search(self.buffer)
                if end_match:
                    # 파일 내용 완성
                    self.current_file_content += self.buffer[: end_match.start()]
                    events.append(
                        {
                            "type": "code",
                            "path": self.current_file_path,
                            "content": _postprocess_code(self.current_file_content.strip()),
                        }
                    )

                    # 파일 모드 종료
                    self.inside_file = False
                    self.current_file_path = None
                    self.current_file_content = ""
                    self.buffer = self.buffer[end_match.end() :]
                else:
                    # 파일 내용 계속 버퍼링
                    break

        return events

    def flush(self) -> list[dict]:
        """남은 버퍼 처리 (스트리밍 종료 시 호출)"""
        events: list[dict] = []
        remaining = self.buffer.strip()
        if remaining and not self.inside_file:
            events.append({"type": "chat", "text": remaining})
        return events


# ============================================================================
# API Endpoints
# ============================================================================


@router.post(
    "",
    response_model=ChatResponse,
    summary="AI 채팅 (Non-streaming)",
    description="""
자연어로 UI를 설명하면 React TSX 코드를 생성합니다.

## 요청 예시
```json
{
  "message": "로그인 페이지 만들어줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 응답 구조
- `message`: AI 원본 응답
- `parsed.conversation`: 한국어 설명
- `parsed.files`: 생성된 코드 파일 목록
- `usage`: 토큰 사용량

## room_id
채팅방 ID (필수). 메시지가 해당 채팅방에 저장됩니다.

## 스키마 모드
채팅방의 schema_key가 설정되어 있으면 Firebase Storage에서 컴포넌트 스키마를 로드합니다.
없으면 자유 모드(React + Tailwind CSS)로 동작합니다.

## from_message_id (선택)
특정 메시지의 코드를 기준으로 수정합니다. 해당 메시지까지의 컨텍스트를 사용하고, 그 메시지의 코드를 기반으로 AI가 수정합니다.
```json
{
  "message": "버튼을 빨간색으로 바꿔줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "from_message_id": "886e7406-55f7-4582-9f4b-7a56ec4562d8"
}
```
""",
    response_description="AI 응답 및 파싱된 결과",
    responses={
        200: {"description": "성공"},
        400: {"description": "잘못된 요청 (stream=true인 경우)"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "AI API 호출 실패"},
    },
)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    AI 채팅 API (Non-streaming)

    디자인 시스템 컴포넌트를 기반으로 React UI 코드를 생성합니다.
    응답의 `parsed` 필드에서 대화 내용과 코드 파일이 분리되어 제공됩니다.

    스트리밍 응답이 필요한 경우 `/stream` 엔드포인트를 사용하세요.

    채팅방의 schema_key가 설정되어 있으면 Firebase Storage에서 스키마를 로드합니다.
    """
    try:
        if request.stream:
            raise HTTPException(
                status_code=400,
                detail="Use /stream endpoint for streaming responses",
            )

        # room 조회 및 검증
        room = await get_chat_room(request.room_id)
        if room is None:
            raise RoomNotFoundError(f"채팅방을 찾을 수 없습니다: {request.room_id}")

        question_created_at = get_timestamp_ms()

        provider = get_ai_provider()
        system_prompt = await resolve_system_prompt(
            schema_key=room.get("schema_key"),
            current_composition=request.current_composition,
            selected_instance_id=request.selected_instance_id,
        )

        # 이전 대화 내역 포함하여 메시지 빌드
        messages = await build_conversation_history(
            room_id=request.room_id,
            system_prompt=system_prompt,
            current_message=request.message,
            from_message_id=request.from_message_id,
        )

        response_message, usage = await provider.chat(messages)
        parsed = parse_ai_response(response_message.content)
        await _maybe_validate_and_repair(parsed, provider)

        # DB에 메시지 저장 (question + text + code 하나의 문서로)
        first_file = parsed.files[0] if parsed.files else None
        await create_chat_message(
            room_id=request.room_id,
            question=request.message,
            text=parsed.conversation,
            content=first_file.content if first_file else "",
            path=first_file.path if first_file else "",
            question_created_at=question_created_at,
            status="DONE",
        )

        return ChatResponse(message=response_message, parsed=parsed, usage=usage)
    except HTTPException:
        raise
    except RoomNotFoundError as e:
        raise HTTPException(status_code=404, detail="Chat room not found.") from e
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except DatabaseError as e:
        logger.error("Database error in chat", extra={"room_id": request.room_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Database error. Please try again.") from e
    except Exception as e:
        logger.error("Unexpected error in chat", extra={"room_id": request.room_id, "error": str(e)})
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again."
        ) from e


@router.post(
    "/stream",
    summary="AI 채팅 (Broadcast)",
    description="""
Supabase Realtime broadcast를 통해 실시간 스트리밍 응답을 받습니다.
이미지가 포함되면 Vision 모드로 동작합니다.

## 동작 방식

1. 클라이언트가 Supabase Realtime `room:{room_id}` 채널을 구독
2. 이 엔드포인트 호출 → `{ "message_id": "..." }` 즉시 반환 (202)
3. 서버가 백그라운드에서 AI 응답을 생성하며 broadcast 이벤트 발행
4. 클라이언트가 broadcast 이벤트로 실시간 수신

## 요청 예시 (텍스트만)
```json
{
  "message": "로그인 페이지 만들어줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 요청 예시 (이미지 포함 - Vision 모드)
먼저 `/chat/images`로 이미지를 업로드한 후 URL을 사용합니다.

```json
{
  "message": "이 디자인을 React 코드로 만들어줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "image_urls": [
    "https://storage.googleapis.com/bucket/user_uploads/room-id/1234_uuid.png"
  ]
}
```

## Broadcast 이벤트 타입

| 타입 | 설명 | 필드 |
|------|------|------|
| `start` | 스트리밍 시작 | `message_id` |
| `chat` | 대화 텍스트 (실시간) | `text` |
| `code` | 코드 파일 (완성 후) | `path`, `content` |
| `done` | 스트리밍 완료 | `message_id` |
| `error` | 오류 발생 | `error` |

## 제한 (Vision 모드)
- 최대 5개 이미지
- 지원 형식: JPEG, PNG, GIF, WebP

## from_message_id (선택)
특정 메시지의 코드를 기준으로 수정합니다. 해당 메시지까지의 컨텍스트를 사용하고, 그 메시지의 코드를 기반으로 AI가 수정합니다.
```json
{
  "message": "버튼을 빨간색으로 바꿔줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "from_message_id": "886e7406-55f7-4582-9f4b-7a56ec4562d8"
}
```
""",
    response_model=BroadcastResponse,
    status_code=202,
    responses={
        202: {"description": "AI 응답 생성 시작 (broadcast로 결과 수신)"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "AI API 호출 실패"},
    },
)
async def chat_stream(request: ChatRequest) -> JSONResponse:
    """
    AI 채팅 API (Broadcast) - Supabase Realtime 기반

    - 즉시 message_id를 반환하고 백그라운드에서 AI 응답 생성
    - 클라이언트는 Supabase Realtime room:{room_id} 채널에서 broadcast 수신
    - 이미지가 포함되면 Vision 모드로 동작합니다

    채팅방의 schema_key가 설정되어 있으면 Storage에서 스키마를 로드합니다.
    """
    try:
        # Figma / Vision 모드 여부 판단
        # 명시적 figma_url 필드 또는 메시지 내 Figma URL 자동 감지
        figma_url = request.figma_url or extract_figma_url(request.message)
        is_figma_mode = bool(figma_url)
        is_vision_mode = bool(request.image_urls and len(request.image_urls) > 0)

        # 이미지 URL에서 base64로 변환 (Vision 모드인 경우)
        images: list[ImageContent] = []
        if is_vision_mode:
            settings = get_settings()
            for url in request.image_urls:  # type: ignore
                try:
                    base64_data, media_type = await fetch_image_as_base64(url)
                    # base64 디코딩 없이 원본 크기 추정 (base64는 ~33% 오버헤드)
                    estimated_size = len(base64_data) * 3 // 4
                    if estimated_size > settings.max_image_size_bytes:
                        logger.warning(
                            "Image exceeds size limit, skipping",
                            extra={"url": url, "size_mb": estimated_size / 1024 / 1024, "limit_mb": settings.max_image_size_mb},
                        )
                        continue
                    images.append(ImageContent(media_type=media_type, data=base64_data))
                except Exception as e:
                    logger.warning("Failed to fetch image", extra={"url": url, "error": str(e)})
                    # 실패한 이미지는 건너뛰고 계속 진행

            # 모든 이미지 로드 실패 시 일반 모드로 전환
            if not images:
                is_vision_mode = False
                logger.warning("All images failed, falling back to normal mode", extra={"room_id": request.room_id})

        # 1. room 조회 및 검증
        room = await get_chat_room(request.room_id)
        if room is None:
            raise RoomNotFoundError(f"채팅방을 찾을 수 없습니다: {request.room_id}")

        question_created_at = get_timestamp_ms()

        # 2. GENERATING 상태로 메시지 먼저 생성
        question_text = request.message
        if is_figma_mode:
            question_text = f"[Figma] {request.message}"
        elif is_vision_mode:
            question_text = f"[이미지 {len(images)}개] {request.message}"

        message_data = await create_chat_message(
            room_id=request.room_id,
            question=question_text,
            question_created_at=question_created_at,
            status="GENERATING",
            image_urls=request.image_urls if is_vision_mode else None,
        )
        message_id = message_data["id"]

        # 3. AI Provider 초기화
        provider = get_ai_provider()

        # 4. 시스템 프롬프트 생성 (Figma/Vision/일반 모드에 따라 분기)
        if is_figma_mode:
            system_prompt = await resolve_system_prompt(
                schema_key=room.get("schema_key"),
                current_composition=request.current_composition,
                selected_instance_id=request.selected_instance_id,
                skip_ui_patterns=True,
            )
        elif is_vision_mode:
            # Vision 모드에서도 컴포넌트 정의 로드
            vision_component_definitions = None
            try:
                vision_component_definitions = await fetch_component_definitions_from_storage()
            except Exception as e:
                logger.warning("Component definitions not loaded for vision", extra={"error": str(e)})

            system_prompt = await get_vision_system_prompt(
                schema_key=room.get("schema_key"),
                image_urls=request.image_urls,
                component_definitions=vision_component_definitions,
            )
        else:
            system_prompt = await resolve_system_prompt(
                schema_key=room.get("schema_key"),
                current_composition=request.current_composition,
                selected_instance_id=request.selected_instance_id,
            )

        # 5. 이전 대화 내역 포함하여 메시지 빌드
        messages = await build_conversation_history(
            room_id=request.room_id,
            system_prompt=system_prompt,
            current_message=request.message,
            from_message_id=request.from_message_id,
        )

        # 6. 백그라운드 태스크로 AI 생성 + broadcast 시작
        task = asyncio.create_task(
            _run_broadcast_generation(
                room_id=request.room_id,
                message_id=message_id,
                user_id=request.user_id,
                provider=provider,
                messages=messages,
                images=images,
                is_vision_mode=is_vision_mode,
                figma_url=figma_url if is_figma_mode else None,
                system_prompt=system_prompt if is_figma_mode else None,
                user_message=request.message if is_figma_mode else None,
            ),
            name=f"broadcast:{request.room_id}:{message_id}",
        )
        track_broadcast_task(task)

        # 7. 즉시 202 응답 반환
        return JSONResponse(
            status_code=202,
            content=BroadcastResponse(message_id=message_id).model_dump(),
        )

    except RoomNotFoundError as e:
        raise HTTPException(status_code=404, detail="Chat room not found.") from e
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except DatabaseError as e:
        logger.error("Database error in chat_stream", extra={"room_id": request.room_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Database error. Please try again.") from e
    except Exception as e:
        logger.error("Unexpected error in chat_stream", extra={"room_id": request.room_id, "error": str(e)})
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again."
        ) from e



_DB_MAX_RETRIES = 3
_DB_BASE_DELAY = 0.5  # seconds


async def _save_message_with_retry(
    *,
    message_id: str,
    text: str | None = None,
    content: str | None = None,
    path: str | None = None,
    status: str | None = None,
) -> None:
    """DB 메시지 저장을 재시도 포함으로 수행 (최대 3회, 지수 백오프)."""
    last_error: Exception | None = None

    for attempt in range(_DB_MAX_RETRIES):
        try:
            await update_chat_message(
                message_id=message_id,
                text=text,
                content=content,
                path=path,
                status=status,
            )
            return
        except Exception as e:
            last_error = e
            logger.warning(
                "DB save failed (retrying)",
                extra={"message_id": message_id, "attempt": attempt + 1, "error": str(e)},
            )
            if attempt < _DB_MAX_RETRIES - 1:
                await asyncio.sleep(_DB_BASE_DELAY * (2 ** attempt))

    logger.error(
        "DB save failed after retries",
        extra={"message_id": message_id, "max_retries": _DB_MAX_RETRIES},
    )
    raise last_error  # type: ignore[misc]


async def _run_broadcast_generation(
    *,
    room_id: str,
    message_id: str,
    user_id: str | None,
    provider,
    messages: list,
    images: list[ImageContent],
    is_vision_mode: bool,
    figma_url: str | None = None,
    system_prompt: str | None = None,
    user_message: str | None = None,
) -> None:
    """백그라운드에서 AI 응답을 생성하고 broadcast 이벤트를 발행한다."""
    parser = StreamingParser()
    collected_text = ""
    collected_files: list[dict] = []
    heartbeat_task: asyncio.Task | None = None
    chunk_sender_task: asyncio.Task | None = None
    chunk_queue: asyncio.Queue[dict | None] = asyncio.Queue()
    dropped_chunks = 0

    async def _heartbeat_loop() -> None:
        """30초마다 heartbeat 이벤트를 전송하여 프론트엔드 연결 유지."""
        try:
            while True:
                await asyncio.sleep(30)
                await broadcast_event(room_id, "chunk", {"type": "heartbeat"})
        except asyncio.CancelledError:
            pass

    def _fire_and_forget_save(**kwargs: Any) -> None:
        """DB 중간 저장을 fire-and-forget으로 실행. 실패해도 무시 — 최종 저장이 대체."""
        async def _do_save() -> None:
            try:
                await update_chat_message(**kwargs)
            except Exception:
                pass

        asyncio.create_task(_do_save())

    async def _chunk_sender() -> None:
        """큐에서 chunk를 꺼내 순서대로 broadcast. 실패 시 drop하고 계속 진행."""
        nonlocal dropped_chunks
        while True:
            item = await chunk_queue.get()
            if item is None:
                break
            try:
                await broadcast_event(
                    room_id, "chunk", item, max_retries=1, base_delay=0.2,
                )
            except Exception as e:
                dropped_chunks += 1
                logger.warning(
                    "Chunk broadcast dropped",
                    extra={
                        "room_id": room_id,
                        "error": f"{type(e).__name__}: {e!r}",
                        "dropped_total": dropped_chunks,
                    },
                )

    try:
        # start 이벤트
        await broadcast_event(room_id, "start", {"message_id": message_id, "user_id": user_id})

        # heartbeat 태스크 시작 (프론트엔드 150초 타임아웃 방지)
        heartbeat_task = asyncio.create_task(_heartbeat_loop())
        chunk_sender_task = asyncio.create_task(_chunk_sender())

        async with asyncio.timeout(600):  # 10분 타임아웃
            # Figma / Vision / 일반 모드에 따라 스트리밍 호출
            if figma_url and system_prompt and user_message:
                stream = run_figma_tool_calling_loop(
                    room_id=room_id,
                    provider=provider,
                    system_prompt=system_prompt,
                    user_message=user_message,
                    figma_url=figma_url,
                )
            elif is_vision_mode:
                # Vision 미지원 프로바이더인지 확인 후 폴백
                _supports_vision = type(provider).chat_vision_stream is not AIProvider.chat_vision_stream
                if not _supports_vision:
                    logger.warning(
                        "Vision not supported, falling back to text-only",
                        extra={"room_id": room_id, "provider": get_settings().ai_provider},
                    )
                    await broadcast_event(
                        room_id,
                        "warning",
                        {"message": "현재 AI 프로바이더는 이미지 분석을 지원하지 않아 텍스트만으로 처리합니다."},
                    )
                    stream = provider.chat_stream(messages)
                else:
                    stream = provider.chat_vision_stream(messages, images)
            else:
                stream = provider.chat_stream(messages)

            async for chunk in stream:
                events = parser.process_chunk(chunk)
                for event in events:
                    event_type = event.pop("type")
                    if event_type == "chat":
                        collected_text += event.get("text", "")
                    elif event_type == "code":
                        collected_files.append(event)
                        # 코드 블록 도착 즉시 중간 저장 (timeout 시 데이터 유실 방지)
                        first_file = collected_files[0]
                        _fire_and_forget_save(
                            message_id=message_id,
                            text=collected_text.strip(),
                            content=first_file.get("content", ""),
                            path=first_file.get("path", ""),
                            status="GENERATING",
                        )

                    await chunk_queue.put({"type": event_type, **event})

        # 남은 버퍼 처리
        final_events = parser.flush()
        for event in final_events:
            event_type = event.pop("type")
            if event_type == "chat":
                collected_text += event.get("text", "")
            await chunk_queue.put({"type": event_type, **event})

        # chunk sender 종료 대기 (남은 큐 drain, 30초 한도)
        await chunk_queue.put(None)
        try:
            async with asyncio.timeout(30):
                await chunk_sender_task
        except TimeoutError:
            logger.warning(
                "Chunk sender drain timed out, cancelling",
                extra={"room_id": room_id, "queue_remaining": chunk_queue.qsize()},
            )
            chunk_sender_task.cancel()
        chunk_sender_task = None

        if dropped_chunks:
            logger.warning(
                "Chunks dropped during generation",
                extra={"room_id": room_id, "message_id": message_id, "dropped": dropped_chunks},
            )

        # 완료 시 DB 저장 (재시도 포함)
        first_file = collected_files[0] if collected_files else None
        await _save_message_with_retry(
            message_id=message_id,
            text=collected_text.strip(),
            content=first_file.get("content", "") if first_file else "",
            path=first_file.get("path", "") if first_file else "",
            status="DONE",
        )

        done_payload = {"message_id": message_id}
        done_payload.update(_build_done_validation_payload(collected_files))
        await broadcast_event(room_id, "done", done_payload)

    except TimeoutError:
        logger.error(
            "Broadcast generation timed out",
            extra={"room_id": room_id, "message_id": message_id, "timeout_seconds": 600},
        )
        try:
            # 타임아웃 시에도 이미 수신한 파일이 있으면 함께 저장 (유저 데이터 유실 방지)
            first_file = collected_files[0] if collected_files else None
            await _save_message_with_retry(
                message_id=message_id,
                text=collected_text.strip() if collected_text else None,
                content=first_file["content"] if first_file else None,
                path=first_file["path"] if first_file else None,
                status="ERROR",
            )
            await broadcast_event(
                room_id,
                "error",
                {"error": "응답 생성 시간이 초과되었습니다. 다시 시도해주세요."},
            )
        except Exception:
            logger.exception("Failed to handle timeout", extra={"room_id": room_id, "message_id": message_id})
    except NotImplementedError:
        logger.error("Vision not supported", extra={"room_id": room_id, "provider": get_settings().ai_provider})
        await _save_message_with_retry(message_id=message_id, status="ERROR")
        await broadcast_event(
            room_id,
            "error",
            {"error": "현재 AI 프로바이더는 Vision 기능을 지원하지 않습니다."},
        )
    except FigmaRateLimitError:
        logger.warning(
            "Figma rate limit exhausted",
            extra={"room_id": room_id, "message_id": message_id},
        )
        try:
            await _save_message_with_retry(message_id=message_id, status="ERROR")
            await broadcast_event(
                room_id,
                "error",
                {
                    "error": "피그마 이용 횟수를 모두 소진했습니다. 런타임허브 담당자에게 문의 부탁드립니다.",
                    "error_code": "figma_rate_limit",
                },
            )
        except Exception:
            logger.exception(
                "Failed to send figma rate limit broadcast",
                extra={"room_id": room_id, "message_id": message_id},
            )
    except Exception as e:
        logger.exception(
            "Broadcast generation error",
            extra={"room_id": room_id, "message_id": message_id, "error": f"{type(e).__name__}: {e!r}"},
        )
        try:
            first_file = collected_files[0] if collected_files else None
            await _save_message_with_retry(
                message_id=message_id,
                text=collected_text.strip() if collected_text else None,
                content=first_file["content"] if first_file else None,
                path=first_file["path"] if first_file else None,
                status="ERROR",
            )
            await broadcast_event(
                room_id,
                "error",
                {"error": "An error occurred during generation. Please try again."},
            )
        except Exception:
            logger.exception("Failed to send error broadcast", extra={"room_id": room_id, "message_id": message_id})
    finally:
        if heartbeat_task and not heartbeat_task.done():
            heartbeat_task.cancel()
        if chunk_sender_task and not chunk_sender_task.done():
            chunk_sender_task.cancel()


# ============================================================================
# Description Generation
# ============================================================================




