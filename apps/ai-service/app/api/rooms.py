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
- `schema_key`: 스키마 경로 (초기값: null, POST /components/schemas로 설정 가능)
- `user_id`: 사용자 ID
- `created_at`: 생성 시간 (ms timestamp)

## 스키마 설정 방법
채팅방 생성 후 `POST /components/schemas`로 스키마를 생성하면 자동으로 `schema_key`가 설정됩니다.
""",
    responses={
        201: {"description": "채팅방 생성 성공"},
        500: {"description": "서버 오류"},
    },
)
async def create_room(request: CreateRoomRequest) -> RoomResponse:
    """
    새 채팅방 생성

    생성 시 schema_key는 null이며, POST /components/schemas로 스키마를 생성하면
    자동으로 schema_key가 설정됩니다.
    """
    try:
        room_data = await create_chat_room(
            user_id=request.user_id,
            storybook_url=request.storybook_url,
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
