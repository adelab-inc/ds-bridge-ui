import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import verify_api_key
from app.schemas.chat import CreateRoomRequest, RoomResponse, UpdateRoomRequest
from app.services.firestore import (
    FirestoreError,
    RoomNotFoundError,
    create_chat_room,
    get_chat_room,
    update_chat_room,
)
from app.services.firebase_storage import upload_schema_to_storage
from app.api.storybook import fetch_storybook_index, parse_storybook_index

router = APIRouter(dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)


@router.post(
    "",
    response_model=RoomResponse,
    status_code=status.HTTP_201_CREATED,
    summary="채팅방 생성",
    description="""
새로운 채팅방을 생성합니다.

## 요청 예시
```json
{
  "storybook_url": "https://storybook.example.com",
  "user_id": "user-123"
}
```

## 응답
- `id`: 생성된 채팅방 UUID
- `storybook_url`: Storybook URL
- `user_id`: 사용자 ID
- `created_at`: 생성 시간
""",
    responses={
        201: {"description": "채팅방 생성 성공"},
        500: {"description": "서버 오류"},
    },
)
async def create_room(request: CreateRoomRequest) -> RoomResponse:
    """
    새 채팅방 생성

    채팅방 ID는 서버에서 UUID로 자동 생성됩니다.
    storybook_url이 있으면 자동으로 컴포넌트 스키마를 추출하여 Storage에 저장합니다.
    """
    try:
        schema_extracted = False

        # 1. storybook_url에서 스키마 추출 시도
        if request.storybook_url:
            try:
                index_data = await fetch_storybook_index(request.storybook_url)
                # 스키마 추출 성공 - room 생성 후 저장
                schema_extracted = True
            except HTTPException as e:
                logger.warning(
                    "Failed to fetch Storybook index: %s",
                    e.detail,
                )
                index_data = None
            except Exception as e:
                logger.warning(
                    "Failed to fetch Storybook index: %s",
                    str(e),
                )
                index_data = None

        # 2. 채팅방 생성
        room_data = await create_chat_room(
            storybook_url=request.storybook_url,
            user_id=request.user_id,
            schema_extracted=schema_extracted,
        )
        room_id = room_data["id"]

        # 3. 스키마 추출 성공 시 Storage에 업로드
        if schema_extracted and index_data:
            try:
                schema = parse_storybook_index(index_data, request.storybook_url)
                schema_key = f"exports/{room_id}/component-schema.json"
                await upload_schema_to_storage(schema_key, schema.model_dump())
                logger.info("Schema uploaded for room %s: %s", room_id, schema_key)
            except Exception as e:
                # 업로드 실패 시 schema_extracted를 false로 변경
                logger.warning(
                    "Failed to upload schema for room %s: %s",
                    room_id,
                    str(e),
                )
                schema_extracted = False
                room_data = await update_chat_room(
                    room_id=room_id,
                    schema_extracted=False,
                )

        return RoomResponse(**room_data)
    except FirestoreError as e:
        logger.error("Failed to create room: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e
    except Exception as e:
        logger.error("Failed to create room: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        ) from e


@router.get(
    "/{room_id}",
    response_model=RoomResponse,
    summary="채팅방 조회",
    description="채팅방 ID로 채팅방 정보를 조회합니다.",
    responses={
        200: {"description": "조회 성공"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "서버 오류"},
    },
)
async def get_room(room_id: str) -> RoomResponse:
    """채팅방 조회"""
    try:
        room_data = await get_chat_room(room_id)

        if not room_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        return RoomResponse(**room_data)
    except HTTPException:
        raise
    except FirestoreError as e:
        logger.error("Failed to get room %s: %s", room_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e
    except Exception as e:
        logger.error("Failed to get room %s: %s", room_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        ) from e


@router.patch(
    "/{room_id}",
    response_model=RoomResponse,
    summary="채팅방 업데이트",
    description="""
채팅방 정보를 업데이트합니다.

## 요청 예시
```json
{
  "storybook_url": "https://new-storybook.example.com"
}
```

## 업데이트 가능한 필드
- `storybook_url`: Storybook URL (변경 시 스키마 재추출)
""",
    responses={
        200: {"description": "업데이트 성공"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "서버 오류"},
    },
)
async def update_room(room_id: str, request: UpdateRoomRequest) -> RoomResponse:
    """채팅방 업데이트 (storybook_url 변경 시 스키마 재추출)"""
    try:
        schema_extracted = False

        # storybook_url 변경 시 스키마 재추출
        if request.storybook_url:
            try:
                index_data = await fetch_storybook_index(request.storybook_url)
                schema = parse_storybook_index(index_data, request.storybook_url)
                schema_key = f"exports/{room_id}/component-schema.json"
                await upload_schema_to_storage(schema_key, schema.model_dump())
                schema_extracted = True
                logger.info("Schema re-extracted for room %s: %s", room_id, schema_key)
            except Exception as e:
                logger.warning(
                    "Failed to re-extract schema for room %s: %s",
                    room_id,
                    str(e),
                )

        room_data = await update_chat_room(
            room_id=room_id,
            storybook_url=request.storybook_url,
            schema_extracted=schema_extracted if request.storybook_url else None,
        )
        return RoomResponse(**room_data)
    except RoomNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found.",
        )
    except FirestoreError as e:
        logger.error("Failed to update room %s: %s", room_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e
    except Exception as e:
        logger.error("Failed to update room %s: %s", room_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        ) from e
