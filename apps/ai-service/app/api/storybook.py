"""
Storybook 컴포넌트 스키마 추출 API

Storybook URL에서 index.json을 fetch하여 컴포넌트 스키마를 추출합니다.
"""

import hashlib
import re
from datetime import datetime
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from app.core.auth import verify_api_key
from app.services.firebase_storage import upload_schema_to_storage

router = APIRouter(dependencies=[Depends(verify_api_key)])


# ============================================================================
# Schemas
# ============================================================================


class StorySchema(BaseModel):
    """스토리 정보"""

    id: str
    name: str
    tags: list[str] | None = None


class ComponentSchema(BaseModel):
    """컴포넌트 스키마"""

    displayName: str
    filePath: str | None = None
    category: str
    stories: list[StorySchema] = []
    argTypes: dict | None = None  # Storybook에서 제공하는 경우


class ExtractedSchema(BaseModel):
    """추출된 스키마 데이터"""

    version: str = "1.0.0"
    generatedAt: str
    sourceUrl: str
    components: dict[str, ComponentSchema]
    totalComponents: int
    totalStories: int


class ExtractResponse(BaseModel):
    """스키마 추출 및 업로드 응답"""

    success: bool
    schema_key: str = Field(..., description="Firebase Storage 경로 (chat API의 schema_key로 사용)")
    source_url: str
    total_components: int
    total_stories: int
    message: str


class ExtractRequest(BaseModel):
    """스키마 추출 요청"""

    storybook_url: HttpUrl = Field(
        ...,
        description="Storybook URL (예: https://example.com/storybook)",
        json_schema_extra={"example": "https://example.com/storybook"},
    )
    room_id: str = Field(
        ...,
        description="채팅방 ID (스키마 저장 경로에 사용)",
        json_schema_extra={"example": "abc123xyz"},
    )


class ComponentListResponse(BaseModel):
    """컴포넌트 목록 응답"""

    components: list[dict]
    total: int


# ============================================================================
# Utility Functions
# ============================================================================


def normalize_storybook_url(url: str) -> str:
    """Storybook URL 정규화 (trailing slash 보장)"""
    url = str(url).rstrip("/")
    # iframe.html이나 ?path= 등 제거
    url = re.sub(r"/iframe\.html.*$", "", url)
    url = re.sub(r"\?.*$", "", url)
    return url + "/"


def generate_schema_key(room_id: str) -> str:
    """room_id 기반으로 schema_key 생성"""
    return f"exports/{room_id}/component-schema.json"


def extract_category(title: str) -> str:
    """타이틀에서 카테고리 추출 (예: 'UI/Button' -> 'UI')"""
    parts = title.split("/")
    return parts[0] if len(parts) > 1 else "Uncategorized"


def extract_component_name(title: str) -> str:
    """타이틀에서 컴포넌트 이름 추출 (예: 'UI/Button' -> 'Button')"""
    parts = title.split("/")
    return parts[-1] if parts else title


async def fetch_storybook_index(base_url: str) -> dict:
    """Storybook index.json 또는 stories.json fetch"""
    base_url = normalize_storybook_url(base_url)

    # 시도할 경로 목록
    paths = [
        "index.json",
        "stories.json",
    ]

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        for path in paths:
            url = urljoin(base_url, path)
            try:
                response = await client.get(url)
                if response.status_code == 200:
                    return response.json()
            except (httpx.HTTPError, ValueError):
                continue

    raise HTTPException(
        status_code=404,
        detail=f"Storybook index.json을 찾을 수 없습니다. URL: {base_url}",
    )


def parse_storybook_index(index_data: dict, source_url: str) -> ExtractedSchema:
    """Storybook index.json 파싱하여 컴포넌트 스키마 생성"""
    entries = index_data.get("entries", {})

    # 컴포넌트별로 스토리 그룹화
    component_map: dict[str, ComponentSchema] = {}
    total_stories = 0

    for entry_id, entry in entries.items():
        # docs 타입은 건너뛰기
        if entry.get("type") == "docs":
            continue

        title = entry.get("title", "")
        component_name = extract_component_name(title)
        category = extract_category(title)

        # 컴포넌트가 없으면 생성
        if component_name not in component_map:
            component_map[component_name] = ComponentSchema(
                displayName=component_name,
                filePath=entry.get("componentPath"),
                category=category,
                stories=[],
            )

        # 스토리 추가
        story = StorySchema(
            id=entry.get("id", entry_id),
            name=entry.get("name", ""),
            tags=entry.get("tags"),
        )
        component_map[component_name].stories.append(story)
        total_stories += 1

    return ExtractedSchema(
        generatedAt=datetime.now(ZoneInfo("Asia/Seoul")).isoformat(),
        sourceUrl=source_url,
        components=component_map,
        totalComponents=len(component_map),
        totalStories=total_stories,
    )


# ============================================================================
# API Endpoints
# ============================================================================


@router.post(
    "/extract",
    summary="Storybook에서 컴포넌트 스키마 추출 및 Storage 업로드",
    description="Storybook URL에서 스키마를 추출하여 Firebase Storage에 저장하고 경로를 반환합니다.",
    response_model=ExtractResponse,
    responses={
        200: {"description": "스키마 추출 및 업로드 성공"},
        404: {"description": "Storybook index.json을 찾을 수 없음"},
        422: {"description": "잘못된 URL 형식"},
        500: {"description": "Firebase Storage 업로드 실패"},
    },
)
async def extract_schema(request: ExtractRequest) -> ExtractResponse:
    """
    Storybook URL에서 컴포넌트 스키마 추출 및 Firebase Storage 업로드

    1. Storybook의 index.json 또는 stories.json을 fetch
    2. 컴포넌트별로 스토리 정보를 그룹화
    3. Firebase Storage에 JSON으로 업로드
    4. schema_key 반환 (chat API에서 사용 가능)

    **사용 예시**:
    ```
    POST /storybook/extract
    {"storybook_url": "https://example.com/storybook"}

    → {"schema_key": "schemas/storybook/example-com-abc123-20260120.json", ...}

    POST /chat
    {"message": "로그인 페이지 만들어줘", "schema_key": "schemas/storybook/example-com-abc123-20260120.json"}
    ```
    """
    source_url = str(request.storybook_url)
    index_data = await fetch_storybook_index(source_url)
    schema = parse_storybook_index(index_data, source_url)

    # room_id 기반 schema_key 생성
    schema_key = generate_schema_key(request.room_id)

    # Firebase Storage에 업로드
    try:
        await upload_schema_to_storage(schema_key, schema.model_dump())
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Firebase Storage 업로드 실패: {e}",
        ) from e

    return ExtractResponse(
        success=True,
        schema_key=schema_key,
        source_url=source_url,
        total_components=schema.totalComponents,
        total_stories=schema.totalStories,
        message=f"스키마가 성공적으로 추출되어 저장되었습니다. chat API에서 schema_key='{schema_key}'로 사용하세요.",
    )


@router.get(
    "/components",
    summary="추출된 컴포넌트 목록 조회",
    description="Storybook URL에서 컴포넌트 목록만 간략히 조회합니다.",
    response_model=ComponentListResponse,
    responses={
        200: {"description": "컴포넌트 목록 조회 성공"},
        404: {"description": "Storybook을 찾을 수 없음"},
    },
)
async def list_components(
    storybook_url: HttpUrl,
    category: str | None = None,
) -> ComponentListResponse:
    """
    Storybook에서 컴포넌트 목록 조회

    - category 파라미터로 필터링 가능
    - 각 컴포넌트의 variants, sizes, 스토리 수 반환
    """
    index_data = await fetch_storybook_index(str(storybook_url))
    schema = parse_storybook_index(index_data, str(storybook_url))

    components = []
    for name, comp in schema.components.items():
        # 카테고리 필터
        if category and category.lower() not in comp.category.lower():
            continue

        components.append(
            {
                "name": name,
                "category": comp.category,
                "storyCount": len(comp.stories),
                "stories": [s.name for s in comp.stories[:5]],  # 최대 5개만
            }
        )

    return ComponentListResponse(
        components=components,
        total=len(components),
    )
