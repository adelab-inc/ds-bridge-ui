import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import verify_api_key
from app.schemas.chat import CreateRoomRequest, RoomResponse
from app.services.firestore import FirestoreError, create_chat_room, get_chat_room

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
async def create_room(request: CreateRoomRequest):
    """
    새 채팅방 생성

    채팅방 ID는 서버에서 UUID로 자동 생성됩니다.
    """
    try:
        room_data = await create_chat_room(
            storybook_url=request.storybook_url,
            user_id=request.user_id,
        )
        return RoomResponse(**room_data)
    except FirestoreError as e:
        logger.error("Failed to create room: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error("Failed to create room: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create room: {str(e)}",
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
async def get_room(room_id: str):
    """채팅방 조회"""
    try:
        room_data = await get_chat_room(room_id)

        if not room_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Room not found: {room_id}",
            )

        return RoomResponse(**room_data)
    except HTTPException:
        raise
    except FirestoreError as e:
        logger.error("Failed to get room %s: %s", room_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error("Failed to get room %s: %s", room_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get room: {str(e)}",
        ) from e
