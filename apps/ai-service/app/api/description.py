import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.components import get_description_system_prompt
from app.core.auth import verify_api_key
from app.schemas.chat import Message
from app.schemas.description import (
    DescriptionExtractRequest,
    DescriptionResponse,
    EditContentRequest,
    VersionListResponse,
    VersionSummaryResponse,
)
from app.services.ai_provider import get_ai_provider
from app.services.supabase_db import (
    DatabaseError,
    RoomNotFoundError,
    create_description,
    get_chat_room,
    get_description_by_id,
    get_description_versions,
    get_latest_code_message,
    get_latest_description,
    get_messages_by_room,
    update_edited_content,
)

router = APIRouter(dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)


# ============================================================================
# 디스크립션 추출 시스템 프롬프트 (최초 / 재추출 분기)
# ============================================================================

EXTRACTION_INITIAL_SYSTEM = """\
아래 대화 히스토리와 생성된 코드를 분석하여 화면 디스크립션을 생성하세요.

{base_prompt}
"""

EXTRACTION_WITH_EDITS_SYSTEM = """\
사용자가 이전에 확정한 디스크립션(사용자 확정본)이 제공됩니다.
이 확정본을 **그대로 유지**하면서, 새로 추가된 대화/코드 변경사항만 추가하세요.

## 최우선 규칙 (아래 출력 가이드보다 우선)
1. 사용자 확정본의 **모든 섹션, 모든 항목, 모든 표현을 원문 그대로 유지**합니다.
2. 확정본에 있는 항목은 코드에서 확인되지 않더라도 **절대 삭제하지 마세요**.
3. 새 대화/코드에서 추가된 내용만 적절한 위치에 삽입합니다.
4. 확정본의 기존 문장을 다른 표현으로 바꾸지 마세요.

※ 아래 출력 가이드의 "코드에 존재하지 않는 내용은 작성하지 마세요" 규칙은
  사용자 확정본에 이미 있는 내용에는 적용되지 않습니다.

{base_prompt}
"""


def _build_extraction_messages(
    conversation_history: list[dict],
    code_content: str,
    code_path: str,
    edit_history: dict | None,
    base_prompt: str,
) -> list[Message]:
    """디스크립션 추출용 메시지 리스트 구성"""
    # 시스템 프롬프트 분기
    if edit_history:
        system_content = EXTRACTION_WITH_EDITS_SYSTEM.format(base_prompt=base_prompt)
    else:
        system_content = EXTRACTION_INITIAL_SYSTEM.format(base_prompt=base_prompt)

    messages = [Message(role="system", content=system_content)]

    # 대화 히스토리: 사용자 요청만 추출 (AI 응답은 최종 코드에 이미 반영됨)
    history_parts = []
    for msg in conversation_history:
        q = msg.get("question", "")
        if q:
            history_parts.append(f"[사용자] {q}")

    history_text = "\n".join(history_parts) if history_parts else "(대화 히스토리 없음)"

    # 사용자 메시지 구성
    user_parts = []

    # 편집 이력이 있으면 확정본을 가장 먼저 배치 (base로 인식)
    if edit_history:
        user_parts.append(
            "## 사용자 확정본 (반드시 전체 보존)\n"
            "아래는 사용자가 직접 수정·확정한 디스크립션입니다. "
            "모든 항목을 원문 그대로 유지하고, 새 변경사항만 추가하세요.\n\n"
            f"{edit_history['edited']}"
        )

    user_parts.extend([
        f"## 대화 히스토리\n{history_text}",
        f"## 현재 코드\n파일: {code_path}\n\n```tsx\n{code_content}\n```",
    ])

    messages.append(Message(role="user", content="\n\n".join(user_parts)))
    return messages


def _determine_reason(edit_history: dict | None, has_previous: bool) -> str:
    """생성 사유 결정"""
    if not has_previous:
        return "initial"
    if edit_history:
        return "regenerated_with_edits"
    return "regenerated"





# ============================================================================
# POST /description/extract — 디스크립션 AI 추출
# ============================================================================


@router.post(
    "/extract",
    response_model=DescriptionResponse,
    summary="디스크립션 AI 추출",
    description="""
채팅방의 대화 히스토리 + 최신 코드를 분석하여 화면 디스크립션을 AI로 생성합니다.

## 동작 방식
1. `room_id`로 대화 히스토리, 최신 코드, 이전 편집 이력을 **서버에서 자동 조회**
2. 편집 이력(`edited_content`)이 DB에 있으면 자동으로 AI 컨텍스트에 포함
3. LLM 호출 → 새 버전(version +1) 생성 → `descriptions` 테이블에 저장

## 요청 예시
```json
{ "room_id": "550e8400-e29b-41d4-a716-446655440000" }
```

## reason 값
- `initial`: 최초 추출 (이전 버전 없음)
- `regenerated_with_edits`: 재추출 + 편집 이력 자동 반영
- `regenerated`: 재추출 (편집 이력 없음)
""",
    response_description="생성된 디스크립션",
    responses={
        200: {"description": "추출 성공"},
        404: {"description": "채팅방 또는 코드 미존재"},
        422: {"description": "대화 히스토리 없음"},
        500: {"description": "AI API 호출 실패"},
    },
)
async def extract_description(
    request: DescriptionExtractRequest,
) -> DescriptionResponse:
    try:
        # 1. room 검증
        room = await get_chat_room(request.room_id)
        if room is None:
            raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")

        # 2. 대화 히스토리 조회
        conversation_history = await get_messages_by_room(request.room_id)
        if not conversation_history:
            raise HTTPException(
                status_code=422, detail="대화 히스토리가 없습니다. 먼저 대화를 진행해 주세요."
            )

        # 3. 최신 코드 조회 (DB에서 자동)
        code_message = await get_latest_code_message(request.room_id)
        if code_message is None:
            raise HTTPException(
                status_code=404, detail="생성된 코드가 없습니다."
            )
        code_content = code_message.get("content", "")
        code_path = code_message.get("path", "")

        # 4. 기존 디스크립션 확인 (편집 이력 자동 감지)
        latest_desc = await get_latest_description(request.room_id)
        has_previous = latest_desc is not None

        # 편집 이력: DB에서 자동 감지
        edit_history = None
        if has_previous and latest_desc.get("edited_content"):
            edit_history = {"edited": latest_desc["edited_content"]}

        # 5. 시스템 프롬프트 + 메시지 구성
        base_prompt = get_description_system_prompt()
        messages = _build_extraction_messages(
            conversation_history=conversation_history,
            code_content=code_content,
            code_path=code_path,
            edit_history=edit_history,
            base_prompt=base_prompt,
        )

        # 6. LLM 호출
        provider = get_ai_provider()
        response_message, usage = await provider.chat(messages, thinking_level="off")
        description_text = response_message.content

        if not description_text or not description_text.strip():
            raise HTTPException(
                status_code=500, detail="AI가 빈 응답을 반환했습니다. 다시 시도해 주세요."
            )

        # 7. 생성 사유 결정
        reason = _determine_reason(edit_history, has_previous)

        # 8. DB 저장
        record = await create_description(
            room_id=request.room_id,
            content=description_text,
            reason=reason,
        )

        logger.info(
            "Description extracted",
            extra={
                "room_id": request.room_id,
                "version": record["version"],
                "reason": reason,
                "usage": usage,
            },
        )

        return DescriptionResponse(**record)

    except HTTPException:
        raise
    except RoomNotFoundError as e:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.") from e
    except DatabaseError as e:
        logger.error(
            "Database error in extract_description",
            extra={"room_id": request.room_id, "error": str(e)},
        )
        raise HTTPException(status_code=500, detail="데이터베이스 오류가 발생했습니다.") from e
    except Exception as e:
        logger.error(
            "Unexpected error in extract_description",
            extra={"room_id": request.room_id, "error": str(e)},
        )
        raise HTTPException(
            status_code=500, detail="디스크립션 추출 중 오류가 발생했습니다."
        ) from e


# ============================================================================
# GET /description/{room_id} — 최신 디스크립션 조회
# ============================================================================


@router.get(
    "/{room_id}",
    response_model=DescriptionResponse,
    summary="최신 디스크립션 조회",
    description="""
채팅방의 최신 버전 디스크립션을 조회합니다.

- `edited_content`가 null이 아니면 사용자가 편집한 이력이 있음
- FE 표시: `edited_content ?? content`
""",
    responses={
        200: {"description": "조회 성공"},
        404: {"description": "디스크립션 미존재"},
    },
)
async def get_description(room_id: str) -> DescriptionResponse:
    try:
        desc = await get_latest_description(room_id)
        if desc is None:
            raise HTTPException(status_code=404, detail="디스크립션이 없습니다.")
        return DescriptionResponse(**desc)
    except HTTPException:
        raise
    except DatabaseError as e:
        logger.error("Database error", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="데이터베이스 오류") from e


# ============================================================================
# PUT /description/{room_id}/edit — 편집 이력 저장
# ============================================================================


@router.put(
    "/{room_id}/edit",
    response_model=DescriptionResponse,
    summary="편집 이력 저장",
    description="""
최신 버전의 `edited_content`를 업데이트합니다.

- 사용자가 [저장 후 닫기] 클릭 시 호출
- 수동 편집은 새 버전을 생성하지 않음 (edited_content 필드만 갱신)
- 다음 재추출(`POST /extract`) 시 이 편집 이력이 AI 컨텍스트에 자동 포함됨
""",
    responses={
        200: {"description": "저장 성공"},
        404: {"description": "디스크립션 미존재"},
    },
)
async def edit_description(
    room_id: str, request: EditContentRequest
) -> DescriptionResponse:
    try:
        result = await update_edited_content(room_id, request.edited_content)
        if result is None:
            raise HTTPException(status_code=404, detail="디스크립션이 없습니다.")
        return DescriptionResponse(**result)
    except HTTPException:
        raise
    except DatabaseError as e:
        logger.error("Database error", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="데이터베이스 오류") from e


# ============================================================================
# GET /description/{room_id}/versions — 버전 목록
# ============================================================================


@router.get(
    "/{room_id}/versions",
    response_model=VersionListResponse,
    summary="디스크립션 버전 목록",
    description="해당 채팅방의 모든 디스크립션 버전을 최신순으로 조회합니다. (생성 이력 패널용)",
    responses={200: {"description": "조회 성공"}},
)
async def list_versions(room_id: str) -> VersionListResponse:
    try:
        versions = await get_description_versions(room_id)
        return VersionListResponse(
            versions=[VersionSummaryResponse(**v) for v in versions]
        )
    except DatabaseError as e:
        logger.error("Database error", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="데이터베이스 오류") from e


# ============================================================================
# GET /description/{room_id}/versions/{description_id} — 특정 버전 조회
# ============================================================================


@router.get(
    "/{room_id}/versions/{description_id}",
    response_model=DescriptionResponse,
    summary="특정 버전 디스크립션 조회",
    description="버전 목록에서 받은 `id`로 특정 버전의 전체 디스크립션을 조회합니다. (이력 패널 미리보기용)",
    responses={
        200: {"description": "조회 성공"},
        404: {"description": "해당 버전 미존재"},
    },
)
async def get_version(room_id: str, description_id: str) -> DescriptionResponse:
    try:
        desc = await get_description_by_id(description_id)
        if desc is None or desc.get("room_id") != room_id:
            raise HTTPException(status_code=404, detail="디스크립션을 찾을 수 없습니다.")
        return DescriptionResponse(**desc)
    except HTTPException:
        raise
    except DatabaseError as e:
        logger.error(
            "Database error",
            extra={"room_id": room_id, "description_id": description_id, "error": str(e)},
        )
        raise HTTPException(status_code=500, detail="데이터베이스 오류") from e
