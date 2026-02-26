import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.auth import verify_api_key
from app.core.config import get_settings
from app.schemas.chat import (
    CreateRoomRequest,
    CreateSchemaRequest,
    CreateSchemaResponse,
    ImageUploadResponse,
    PaginatedMessagesResponse,
    RoomResponse,
    SchemaResponse,
    UpdateRoomRequest,
)
from app.services.supabase_storage import (
    fetch_schema_from_storage,
    upload_image_to_storage,
    upload_schema_to_storage,
)
from app.services.supabase_db import (
    DatabaseError,
    RoomData,
    RoomNotFoundError,
    create_chat_room,
    delete_chat_message,
    delete_chat_room,
    get_chat_room,
    get_messages_paginated,
    list_rooms_by_user,
    update_chat_room,
)

router = APIRouter(dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)


# ============================================================================
# Dependencies
# ============================================================================


async def get_room_or_404(room_id: str) -> RoomData:
    """
    채팅방 조회 Dependency - 없으면 404 반환

    Usage:
        @router.get("/{room_id}/something")
        async def endpoint(room: RoomData = Depends(get_room_or_404)):
            ...
    """
    room = await get_chat_room(room_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room not found: {room_id}",
        )
    return room



@router.get(
    "",
    response_model=dict,
    operation_id="listRooms",
    summary="채팅방 목록 조회",
    description="""
유저의 채팅방 목록을 최신순으로 조회합니다.

## Query Parameters
- `user_id` (필수): 사용자 ID
- `limit`: 페이지당 개수 (기본 50, 최대 100)
- `cursor`: 페이지네이션 커서 (이전 응답의 next_cursor 값)

## 응답
```json
{
  "rooms": [...],
  "next_cursor": 1771836645038,
  "has_more": true
}
```
""",
    responses={
        200: {"description": "조회 성공"},
        500: {"description": "서버 오류"},
    },
)
async def list_rooms(
    user_id: str = Query(..., description="사용자 ID"),
    limit: int = Query(50, ge=1, le=100, description="페이지당 개수"),
    cursor: int | None = Query(None, description="페이지네이션 커서 (created_at)"),
) -> dict:
    """유저의 채팅방 목록 조회 (최신순)"""
    try:
        return await list_rooms_by_user(user_id=user_id, limit=limit, cursor=cursor)
    except DatabaseError as e:
        logger.error("Failed to list rooms", extra={"user_id": user_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e


@router.post(
    "",
    response_model=RoomResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createRoom",
    summary="채팅방 생성",
    description="""
새로운 채팅방을 생성합니다.

## 요청 예시
```json
{
  "user_id": "user-123",
  "storybook_url": "https://storybook.example.com"
}
```

## 필드 설명
- `user_id` (필수): 사용자 ID
- `storybook_url` (선택): Storybook URL (참고용)

## 응답
- `id`: 생성된 채팅방 UUID
- `storybook_url`: Storybook URL
- `schema_key`: 스키마 경로 (POST /rooms/{room_id}/schemas로 설정)
- `user_id`: 사용자 ID
- `created_at`: 생성 시간 (ms timestamp)

## 스키마 설정 방법
채팅방 생성 후 `POST /rooms/{room_id}/schemas`로 스키마를 생성하면 자동으로 `schema_key`가 설정됩니다.
""",
    responses={
        201: {"description": "채팅방 생성 성공"},
        500: {"description": "서버 오류"},
    },
)
async def create_room(request: CreateRoomRequest) -> RoomResponse:
    """
    새 채팅방 생성

    생성 시 schema_key는 null이며, POST /rooms/{room_id}/schemas로 스키마를 생성하면
    자동으로 schema_key가 설정됩니다.
    """
    try:
        room_data = await create_chat_room(
            user_id=request.user_id,
            storybook_url=request.storybook_url,
        )

        return RoomResponse(**room_data)
    except DatabaseError as e:
        logger.error("Failed to create room", extra={"error": str(e), "user_id": request.user_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e
    except Exception as e:
        logger.error("Unexpected error creating room", extra={"error": str(e), "user_id": request.user_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        ) from e


@router.get(
    "/{room_id}",
    response_model=RoomResponse,
    operation_id="getRoom",
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
    except DatabaseError as e:
        logger.error("Failed to get room", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e
    except Exception as e:
        logger.error("Unexpected error getting room", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        ) from e


@router.patch(
    "/{room_id}",
    response_model=RoomResponse,
    operation_id="updateRoom",
    summary="채팅방 업데이트",
    description="""
채팅방 정보를 업데이트합니다.

## 요청 예시
```json
{
  "storybook_url": "https://new-storybook.example.com",
  "schema_key": "schemas/new-design-system.json"
}
```

## 업데이트 가능한 필드
- `storybook_url`: Storybook URL
- `schema_key`: Firebase Storage 스키마 경로
""",
    responses={
        200: {"description": "업데이트 성공"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "서버 오류"},
    },
)
async def update_room(room_id: str, request: UpdateRoomRequest) -> RoomResponse:
    """채팅방 업데이트"""
    try:
        room_data = await update_chat_room(
            room_id=room_id,
            storybook_url=request.storybook_url,
            schema_key=request.schema_key,
        )
        return RoomResponse(**room_data)
    except RoomNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found.",
        ) from e
    except DatabaseError as e:
        logger.error("Failed to update room", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e
    except Exception as e:
        logger.error("Unexpected error updating room", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        ) from e


@router.delete(
    "/{room_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteRoom",
    summary="채팅방 삭제",
    description="채팅방과 소속 메시지를 모두 삭제합니다.",
    responses={
        204: {"description": "삭제 성공"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "서버 오류"},
    },
)
async def delete_room(
    room_id: str,
    _room: RoomData = Depends(get_room_or_404),
):
    await delete_chat_room(room_id)


# ============================================================================
# Image Endpoints
# ============================================================================


@router.post(
    "/{room_id}/images",
    response_model=ImageUploadResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="uploadRoomImage",
    summary="채팅 이미지 업로드",
    description="""
Firebase Storage에 이미지를 업로드하고 URL을 반환합니다.

## 사용 흐름
1. 이 API로 이미지 업로드 → URL 획득
2. `/chat/stream`에 `image_urls` 파라미터로 전달

## 저장 경로
`user_uploads/{room_id}/{timestamp}_{uuid}.{ext}`

## 지원 형식
- image/jpeg, image/png, image/gif, image/webp
- 최대 크기는 서버 설정에 따름
""",
    responses={
        201: {"description": "업로드 성공"},
        400: {"description": "잘못된 요청 (파일 없음 등)"},
        404: {"description": "채팅방을 찾을 수 없음"},
        413: {"description": "파일 크기 초과"},
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file"],
                        "properties": {
                            "file": {
                                "type": "string",
                                "format": "binary",
                                "description": "업로드할 이미지 파일",
                            }
                        },
                    }
                }
            }
        }
    },
)
async def upload_room_image(
    room_id: str,
    file: UploadFile = File(...),
    _room: RoomData = Depends(get_room_or_404),  # room 존재 확인
) -> ImageUploadResponse:
    """
    채팅용 이미지를 Firebase Storage에 업로드합니다.
    """
    settings = get_settings()

    # 파일 검증
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일이 없습니다.",
        )

    # Content-Type 검증
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"이미지 파일만 업로드 가능합니다. (받은 타입: {content_type})",
        )

    # 파일 읽기
    image_data = await file.read()
    max_size = settings.max_image_size_bytes

    if len(image_data) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"파일 크기가 {settings.max_image_size_mb}MB를 초과합니다. ({len(image_data) / 1024 / 1024:.1f}MB)",
        )

    # Firebase Storage 업로드
    try:
        public_url, storage_path = await upload_image_to_storage(
            room_id=room_id,
            image_data=image_data,
            media_type=content_type if content_type.startswith("image/") else None,
        )

        logger.info("Image uploaded", extra={"room_id": room_id, "storage_path": storage_path})

        return ImageUploadResponse(url=public_url, path=storage_path)

    except Exception as e:
        logger.error("Failed to upload image", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="이미지 업로드에 실패했습니다.",
        ) from e


# ============================================================================
# Schema Endpoints
# ============================================================================


@router.post(
    "/{room_id}/schemas",
    response_model=CreateSchemaResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createRoomSchema",
    summary="컴포넌트 스키마 생성",
    description="""
클라이언트가 추출한 컴포넌트 스키마를 Firebase Storage에 업로드합니다.

## 사용 흐름
1. `POST /rooms`로 채팅방 생성 → room_id 획득
2. 클라이언트에서 react-docgen-typescript로 스키마 추출
3. 이 API로 스키마 생성

## 저장 경로
`exports/{room_id}/component-schema.json`
""",
    responses={
        201: {"description": "생성 성공"},
        400: {"description": "잘못된 요청"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "서버 오류"},
    },
)
async def create_room_schema(
    room_id: str,
    request: CreateSchemaRequest,
    _room: RoomData = Depends(get_room_or_404),  # room 존재 확인
) -> CreateSchemaResponse:
    """채팅방의 컴포넌트 스키마 생성"""
    try:
        if not request.data.get("components"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Schema must contain 'components' field",
            )

        # room_id 기반 schema_key 생성
        schema_key = f"exports/{room_id}/component-schema.json"

        # Storage에 업로드
        await upload_schema_to_storage(schema_key, request.data)

        # Room의 schema_key 자동 업데이트
        await update_chat_room(room_id=room_id, schema_key=schema_key)

        component_count = len(request.data.get("components", {}))
        uploaded_at = datetime.now(ZoneInfo("Asia/Seoul")).isoformat()

        logger.info(
            "Schema uploaded",
            extra={"room_id": room_id, "schema_key": schema_key, "component_count": component_count},
        )

        return CreateSchemaResponse(
            schema_key=schema_key,
            component_count=component_count,
            uploaded_at=uploaded_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to upload schema", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload schema. Please try again.",
        ) from e


@router.get(
    "/{room_id}/schemas",
    response_model=SchemaResponse,
    operation_id="getRoomSchema",
    summary="채팅방 스키마 조회",
    description="채팅방에 연결된 컴포넌트 스키마를 조회합니다.",
    responses={
        200: {"description": "조회 성공"},
        404: {"description": "채팅방 또는 스키마를 찾을 수 없음"},
    },
)
async def get_room_schema(
    room_id: str,
    room: RoomData = Depends(get_room_or_404),
) -> SchemaResponse:
    """채팅방의 컴포넌트 스키마 조회"""
    try:
        schema_key = room.get("schema_key")
        if not schema_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No schema found for room: {room_id}",
            )

        # Storage에서 스키마 조회
        schema = await fetch_schema_from_storage(schema_key)
        return SchemaResponse(schema_key=schema_key, data=schema)

    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schema file not found: {room_id}",
        ) from e
    except Exception as e:
        logger.error("Failed to get schema", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get schema. Please try again.",
        ) from e


# ============================================================================
# Messages Endpoints
# ============================================================================


@router.get(
    "/{room_id}/messages",
    response_model=PaginatedMessagesResponse,
    operation_id="getRoomMessages",
    summary="채팅 히스토리 조회",
    description="""
채팅방의 메시지 히스토리를 페이지네이션하여 조회합니다.

## Query Parameters
- `limit`: 페이지당 메시지 수 (기본 20, 최대 100)
- `cursor`: 페이지네이션 커서 (이전 응답의 next_cursor 값)
- `order`: 정렬 순서 (desc: 최신순, asc: 오래된순)

## 페이지네이션
첫 요청 시 cursor 없이 호출하고, 다음 페이지는 응답의 `next_cursor` 값을 cursor로 전달합니다.
`has_more`가 false면 마지막 페이지입니다.
""",
    responses={
        200: {"description": "조회 성공"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "서버 오류"},
    },
)
async def get_room_messages(
    room_id: str,
    limit: int = Query(20, ge=1, le=100, description="페이지당 메시지 수"),
    cursor: int | None = Query(None, description="페이지네이션 커서 (answer_created_at)"),
    order: str = Query("desc", pattern="^(asc|desc)$", description="정렬 순서"),
    _room: RoomData = Depends(get_room_or_404),  # room 존재 확인
) -> PaginatedMessagesResponse:
    """채팅방 메시지 히스토리 페이지네이션 조회"""
    try:
        result = await get_messages_paginated(
            room_id=room_id,
            limit=limit,
            cursor=cursor,
            order=order,
        )

        return PaginatedMessagesResponse(
            messages=result["messages"],  # type: ignore[arg-type]
            next_cursor=result["next_cursor"],
            has_more=result["has_more"],
            total_count=result["total_count"],
        )

    except HTTPException:
        raise
    except DatabaseError as e:
        logger.error("Failed to get messages", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e
    except Exception as e:
        logger.error("Unexpected error getting messages", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        ) from e


@router.delete(
    "/{room_id}",
    status_code=status.HTTP_200_OK,
    operation_id="deleteRoom",
    summary="채팅방 삭제",
    description="""
채팅방과 해당 방의 모든 메시지를 삭제합니다.
(DB의 ON DELETE CASCADE로 메시지도 함께 삭제됩니다.)
""",
    responses={
        200: {"description": "삭제 성공"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "서버 오류"},
    },
)
async def delete_room(
    room_id: str,
    _room: RoomData = Depends(get_room_or_404),
) -> dict:
    """채팅방 삭제 (메시지도 CASCADE 삭제)"""
    try:
        await delete_chat_room(room_id)
        return {"message": f"Room {room_id} deleted successfully"}
    except DatabaseError as e:
        logger.error("Failed to delete room", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e


@router.delete(
    "/{room_id}/messages/{message_id}",
    status_code=status.HTTP_200_OK,
    operation_id="deleteMessage",
    summary="메시지 삭제",
    description="채팅방의 특정 메시지를 삭제합니다.",
    responses={
        200: {"description": "삭제 성공"},
        404: {"description": "채팅방 또는 메시지를 찾을 수 없음"},
        500: {"description": "서버 오류"},
    },
)
async def delete_message(
    room_id: str,
    message_id: str,
    _room: RoomData = Depends(get_room_or_404),
) -> dict:
    """개별 메시지 삭제"""
    try:
        deleted = await delete_chat_message(message_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message not found: {message_id}",
            )
        return {"message": f"Message {message_id} deleted successfully"}
    except HTTPException:
        raise
    except DatabaseError as e:
        logger.error("Failed to delete message", extra={"room_id": room_id, "message_id": message_id, "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e
