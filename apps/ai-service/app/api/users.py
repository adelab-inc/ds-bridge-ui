import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import verify_api_key
from app.schemas.chat import UserItem, UserListResponse
from app.services.supabase_db import DatabaseError, list_all_users

router = APIRouter(dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)


@router.get(
    "",
    response_model=UserListResponse,
    operation_id="listUsers",
    summary="멤버 목록 조회 (전체 유저)",
    description="""
copy/move 대상 선택용 전체 유저(auth.users) 목록을 반환합니다.

- 검색/필터는 클라이언트에서 수행합니다(서버는 전체 목록만 제공).
- 각 항목: `id`(user_id), `email`, `name`, `avatar_url`.
""",
    responses={
        200: {"description": "조회 성공"},
        500: {"description": "서버 오류"},
    },
)
async def list_users() -> UserListResponse:
    """전체 멤버 목록 조회 (FE에서 클라이언트 검색)."""
    try:
        users = await list_all_users()
        return UserListResponse(
            users=[UserItem(**u) for u in users],
            total=len(users),
        )
    except DatabaseError as e:
        logger.error("Failed to list users", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        ) from e
    except Exception as e:
        logger.error("Unexpected error listing users", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        ) from e
