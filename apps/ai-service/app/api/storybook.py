"""
Storybook 컴포넌트 스키마 추출 유틸리티

Storybook URL에서 index.json을 fetch하여 컴포넌트 스키마를 추출합니다.
rooms.py에서 내부적으로 사용됩니다.
"""

import re
from datetime import datetime
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import httpx
from fastapi import HTTPException
from pydantic import BaseModel


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
