"""Figma Tool Calling 정의 + 실행기.

AI 모델이 Function Calling으로 Figma 데이터를 자율 탐색하도록
Tool 정의, Provider별 포맷 변환, 병렬 실행을 제공한다.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass

from app.services.figma_api import (
    export_node_image,
    fetch_component_info,
    fetch_node_detail,
    fetch_page_structure,
    parse_figma_url,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 데이터 모델
# ---------------------------------------------------------------------------


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class ToolResult:
    tool_call_id: str
    content: str
    image_base64: str | None = None
    image_media_type: str | None = None
    is_error: bool = False


# ---------------------------------------------------------------------------
# Tool 스키마 정의
# ---------------------------------------------------------------------------

FIGMA_TOOLS: list[dict] = [
    {
        "name": "get_figma_page_structure",
        "description": "Figma URL에서 페이지의 프레임 목록을 가져옵니다. 어떤 프레임들이 있는지 파악할 때 사용하세요.",
        "parameters": {
            "type": "object",
            "properties": {
                "figma_url": {
                    "type": "string",
                    "description": "Figma 페이지/파일 URL",
                },
            },
            "required": ["figma_url"],
        },
    },
    {
        "name": "get_figma_node_detail",
        "description": "특정 Figma 노드의 레이아웃 구조를 compact JSON으로 가져옵니다. 컴포넌트 구성, 텍스트 내용, 스타일을 파악할 때 사용하세요.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_key": {
                    "type": "string",
                    "description": "Figma 파일 키",
                },
                "node_id": {
                    "type": "string",
                    "description": "조회할 노드 ID (예: 123:456)",
                },
            },
            "required": ["file_key", "node_id"],
        },
    },
    {
        "name": "get_figma_screenshot",
        "description": "특정 Figma 노드의 PNG 스크린샷을 가져옵니다. 시각적인 디자인을 확인할 때 사용하세요.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_key": {
                    "type": "string",
                    "description": "Figma 파일 키",
                },
                "node_id": {
                    "type": "string",
                    "description": "스크린샷을 찍을 노드 ID",
                },
            },
            "required": ["file_key", "node_id"],
        },
    },
    {
        "name": "get_figma_component_info",
        "description": "Figma 컴포넌트의 variant/props 정보를 가져옵니다. 컴포넌트의 변형과 속성을 파악할 때 사용하세요.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_key": {
                    "type": "string",
                    "description": "Figma 파일 키",
                },
                "node_id": {
                    "type": "string",
                    "description": "컴포넌트 노드 ID",
                },
            },
            "required": ["file_key", "node_id"],
        },
    },
]


# ---------------------------------------------------------------------------
# Provider별 포맷 변환
# ---------------------------------------------------------------------------


def to_openai_tools() -> list[dict]:
    """OpenAI function calling 형식으로 변환."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            },
        }
        for tool in FIGMA_TOOLS
    ]


def to_anthropic_tools() -> list[dict]:
    """Anthropic tool use 형식으로 변환."""
    return [
        {
            "name": tool["name"],
            "description": tool["description"],
            "input_schema": tool["parameters"],
        }
        for tool in FIGMA_TOOLS
    ]


def to_gemini_tools():
    """Gemini function calling 형식으로 변환."""
    from google.genai import types

    declarations = []
    for tool in FIGMA_TOOLS:
        declarations.append(types.FunctionDeclaration(
            name=tool["name"],
            description=tool["description"],
            parameters=tool["parameters"],
        ))
    return [types.Tool(function_declarations=declarations)]


# ---------------------------------------------------------------------------
# Tool 실행
# ---------------------------------------------------------------------------


async def execute_tool(tool_call: ToolCall) -> ToolResult:
    """단일 tool call 실행."""
    try:
        name = tool_call.name
        args = tool_call.arguments

        if name == "get_figma_page_structure":
            figma_url = args["figma_url"]
            file_key, node_id = parse_figma_url(figma_url)
            result = await fetch_page_structure(file_key, node_id)
            return ToolResult(
                tool_call_id=tool_call.id,
                content=json.dumps(result, ensure_ascii=False, separators=(",", ":")),
            )

        elif name == "get_figma_node_detail":
            result = await fetch_node_detail(args["file_key"], args["node_id"])
            return ToolResult(
                tool_call_id=tool_call.id,
                content=json.dumps(result, ensure_ascii=False, separators=(",", ":")),
            )

        elif name == "get_figma_screenshot":
            base64_data, media_type = await export_node_image(args["file_key"], args["node_id"])
            return ToolResult(
                tool_call_id=tool_call.id,
                content="[스크린샷 이미지]",
                image_base64=base64_data,
                image_media_type=media_type,
            )

        elif name == "get_figma_component_info":
            result = await fetch_component_info(args["file_key"], args["node_id"])
            return ToolResult(
                tool_call_id=tool_call.id,
                content=json.dumps(result, ensure_ascii=False, separators=(",", ":")),
            )

        else:
            return ToolResult(
                tool_call_id=tool_call.id,
                content=f"Unknown tool: {name}",
                is_error=True,
            )

    except Exception as e:
        logger.error("Tool execution error", extra={"tool": tool_call.name, "error": str(e)})
        return ToolResult(
            tool_call_id=tool_call.id,
            content=f"Error: {e}",
            is_error=True,
        )


async def execute_tools_parallel(tool_calls: list[ToolCall]) -> list[ToolResult]:
    """여러 tool call을 병렬 실행."""
    return await asyncio.gather(*(execute_tool(tc) for tc in tool_calls))
