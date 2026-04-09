from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from typing import Any

from anthropic import AsyncAnthropic
from google import genai
from google.genai import types
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.schemas.chat import ImageContent, Message

settings = get_settings()


@dataclass
class ToolCallData:
    """Provider에서 반환하는 tool call 정보."""
    id: str
    name: str
    arguments: dict


@dataclass
class ToolCallResponse:
    """chat_with_tools의 반환값.

    tool_calls가 비어있으면 최종 텍스트 응답,
    tool_calls가 있으면 tool 실행이 필요한 상태.
    """
    content: str | None = None
    tool_calls: list[ToolCallData] = field(default_factory=list)
    raw_message: Any = None  # Provider native 메시지 (대화 이력 추가용)


class AIProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list[Message], **kwargs: Any) -> tuple[Message, dict | None]:
        pass

    @abstractmethod
    async def chat_stream(self, messages: list[Message], **kwargs: Any) -> AsyncGenerator[str, None]:
        pass

    async def chat_vision_stream(
        self,
        messages: list[Message],
        images: list[ImageContent],
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """Vision API 스트리밍 (기본: 미지원)"""
        raise NotImplementedError("Vision not supported by this provider")
        yield  # Generator 타입 힌트용

    async def chat_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | list | None = None,
    ) -> ToolCallResponse:
        """Tool calling 지원 non-streaming 호출 (기본: 미지원)."""
        raise NotImplementedError("Tool calling not supported by this provider")

    async def chat_with_tools_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | list | None = None,
    ) -> AsyncGenerator[str, None]:
        """최종 응답 스트리밍 (tool calling 루프 마지막 턴)."""
        raise NotImplementedError("Tool calling stream not supported by this provider")
        yield


class OpenAIProvider(AIProvider):
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    async def chat(self, messages: list[Message], **kwargs: Any) -> tuple[Message, dict | None]:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=0.5,
        )
        # choices가 비어있을 경우 안전 처리
        content = ""
        if response.choices:
            content = response.choices[0].message.content or ""

        usage = None
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }
        return Message(role="assistant", content=content), usage

    async def chat_stream(self, messages: list[Message], **kwargs: Any) -> AsyncGenerator[str, None]:
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            stream=True,
            temperature=0.5,
        )
        async for chunk in stream:
            # choices가 비어있을 경우 안전 처리
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def chat_vision_stream(
        self,
        messages: list[Message],
        images: list[ImageContent],
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """OpenAI Vision API 스트리밍"""
        chat_messages: list[dict[str, Any]] = []

        for m in messages:
            if m.role == "user" and images:
                # 멀티모달 컨텐츠 배열
                content: list[dict[str, Any]] = []

                # 이미지 추가
                for img in images:
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{img.media_type};base64,{img.data}",
                            "detail": "high",
                        },
                    })

                # 텍스트 추가
                content.append({
                    "type": "text",
                    "text": m.content,
                })

                chat_messages.append({"role": "user", "content": content})
                # 이미지는 첫 번째 user 메시지에만 추가
                images = []
            else:
                chat_messages.append({"role": m.role, "content": m.content})

        stream = await self.client.chat.completions.create(
            model=self.model,  # 설정된 모델 사용 (gpt-4.1, gpt-5.2 등)
            messages=chat_messages,
            max_tokens=8192,
            stream=True,
            temperature=0.5,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def chat_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | list | None = None,
    ) -> ToolCallResponse:
        """OpenAI tool calling (non-streaming)."""
        import json as _json

        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.5,
            "max_tokens": 8192,
        }
        if tools:
            kwargs["tools"] = tools

        response = await self.client.chat.completions.create(**kwargs)
        choice = response.choices[0] if response.choices else None

        if not choice:
            return ToolCallResponse()

        msg = choice.message
        tool_calls: list[ToolCallData] = []

        if msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls.append(ToolCallData(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=_json.loads(tc.function.arguments),
                ))

        return ToolCallResponse(
            content=msg.content,
            tool_calls=tool_calls,
            raw_message=msg,
        )

    async def chat_with_tools_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | list | None = None,
    ) -> AsyncGenerator[str, None]:
        """OpenAI 최종 응답 스트리밍."""
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.5,
            "max_tokens": 8192,
            "stream": True,
        }
        # 최종 턴에서는 tools 제거하여 tool call 방지
        stream = await self.client.chat.completions.create(**kwargs)

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class AnthropicProvider(AIProvider):
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model

    async def chat(self, messages: list[Message], **kwargs: Any) -> tuple[Message, dict | None]:
        system_message = ""
        chat_messages: list[dict[str, Any]] = []

        for m in messages:
            if m.role == "system":
                system_message = m.content
            else:
                chat_messages.append({"role": m.role, "content": m.content})

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=8192,
            system=system_message if system_message else None,
            messages=chat_messages,
            temperature=0.5,
        )
        content = response.content[0].text if response.content else ""
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }
        return Message(role="assistant", content=content), usage

    async def chat_stream(self, messages: list[Message], **kwargs: Any) -> AsyncGenerator[str, None]:
        system_message = ""
        chat_messages: list[dict[str, Any]] = []

        for m in messages:
            if m.role == "system":
                system_message = m.content
            else:
                chat_messages.append({"role": m.role, "content": m.content})

        async with self.client.messages.stream(
            model=self.model,
            max_tokens=8192,
            system=system_message if system_message else None,
            messages=chat_messages,
            temperature=0.5,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def chat_vision_stream(
        self,
        messages: list[Message],
        images: list[ImageContent],
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """Claude Vision API 스트리밍"""
        system_message = ""
        chat_messages: list[dict[str, Any]] = []

        for m in messages:
            if m.role == "system":
                system_message = m.content
            elif m.role == "user" and images:
                # 멀티모달 컨텐츠 블록 구성
                content_blocks: list[dict[str, Any]] = []

                # 이미지 추가
                for img in images:
                    content_blocks.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": img.media_type,
                            "data": img.data,
                        },
                    })

                # 텍스트 추가
                content_blocks.append({
                    "type": "text",
                    "text": m.content,
                })

                chat_messages.append({
                    "role": "user",
                    "content": content_blocks,
                })
                # 이미지는 첫 번째 user 메시지에만 추가
                images = []
            else:
                chat_messages.append({
                    "role": m.role,
                    "content": m.content,
                })

        async with self.client.messages.stream(
            model=self.model,
            max_tokens=8192,  # 코드 생성을 위해 증가
            system=system_message if system_message else None,
            messages=chat_messages,
            temperature=0.5,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def chat_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | list | None = None,
    ) -> ToolCallResponse:
        """Anthropic tool use (non-streaming)."""
        # system 메시지 분리
        system_message = ""
        chat_messages: list[dict[str, Any]] = []
        for m in messages:
            if m.get("role") == "system":
                system_message = m.get("content", "")
            else:
                chat_messages.append(m)

        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": 8192,
            "messages": chat_messages,
            "temperature": 0.5,
        }
        if system_message:
            kwargs["system"] = system_message
        if tools:
            kwargs["tools"] = tools

        response = await self.client.messages.create(**kwargs)

        tool_calls: list[ToolCallData] = []
        text_content = ""

        for block in response.content:
            if block.type == "text":
                text_content += block.text
            elif block.type == "tool_use":
                tool_calls.append(ToolCallData(
                    id=block.id,
                    name=block.name,
                    arguments=block.input,
                ))

        return ToolCallResponse(
            content=text_content or None,
            tool_calls=tool_calls,
            raw_message=response,
        )

    async def chat_with_tools_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | list | None = None,
    ) -> AsyncGenerator[str, None]:
        """Anthropic 최종 응답 스트리밍."""
        system_message = ""
        chat_messages: list[dict[str, Any]] = []
        for m in messages:
            if m.get("role") == "system":
                system_message = m.get("content", "")
            else:
                chat_messages.append(m)

        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": 8192,
            "messages": chat_messages,
            "temperature": 0.5,
        }
        if system_message:
            kwargs["system"] = system_message
        # 최종 턴에서는 tools 제거하여 tool call 방지

        async with self.client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text


_THINKING_LEVEL_MAP: dict[str, types.ThinkingLevel | None] = {
    "off": None,
    "minimal": types.ThinkingLevel.MINIMAL,
    "low": types.ThinkingLevel.LOW,
    "medium": types.ThinkingLevel.MEDIUM,
    "high": types.ThinkingLevel.HIGH,
}


class GeminiProvider(AIProvider):
    def __init__(self):
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.gemini_model

        # Thinking config (off이면 None → config에 포함하지 않음)
        level = _THINKING_LEVEL_MAP.get(settings.gemini_thinking_level.lower())
        self._thinking_config = types.ThinkingConfig(thinking_level=level) if level else None

    async def chat(self, messages: list[Message], **kwargs: Any) -> tuple[Message, dict | None]:
        system_instruction = None
        contents: list[types.Content] = []

        for m in messages:
            if m.role == "system":
                system_instruction = m.content
            else:
                role = "user" if m.role == "user" else "model"
                contents.append(types.Content(role=role, parts=[types.Part(text=m.content)]))

        # thinking_level override 지원 (예: description 생성 시 "off")
        thinking_config = self._thinking_config
        if "thinking_level" in kwargs:
            level = _THINKING_LEVEL_MAP.get(kwargs["thinking_level"])
            thinking_config = types.ThinkingConfig(thinking_level=level) if level else None

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            thinking_config=thinking_config,
            temperature=0.5,
        )

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=config,
        )

        # thinking 파트 제외하고 응답 텍스트만 추출
        parts = (
            response.candidates[0].content.parts
            if response.candidates and response.candidates[0].content
            else []
        )
        content = "".join(p.text for p in parts if p.text and not getattr(p, "thought", False))
        usage = None
        if response.usage_metadata:
            usage = {
                "prompt_tokens": response.usage_metadata.prompt_token_count,
                "completion_tokens": response.usage_metadata.candidates_token_count,
                "total_tokens": response.usage_metadata.total_token_count,
            }
        return Message(role="assistant", content=content), usage

    async def chat_stream(self, messages: list[Message], **kwargs: Any) -> AsyncGenerator[str, None]:
        system_instruction = None
        contents: list[types.Content] = []

        for m in messages:
            if m.role == "system":
                system_instruction = m.content
            else:
                role = "user" if m.role == "user" else "model"
                contents.append(types.Content(role=role, parts=[types.Part(text=m.content)]))

        # disable_thinking=True 시 thinking 비활성화 (Figma 모드 등 속도 우선)
        thinking_config = None if kwargs.get("disable_thinking") else self._thinking_config

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            thinking_config=thinking_config,
            temperature=0.5,
        )

        stream = await self.client.aio.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=config,
        )
        async for chunk in stream:
            # thinking 파트 제외하고 응답 텍스트만 스트리밍
            if chunk.candidates and chunk.candidates[0].content:
                for part in chunk.candidates[0].content.parts:
                    if part.text and not getattr(part, "thought", False):
                        yield part.text

    async def chat_vision_stream(
        self,
        messages: list[Message],
        images: list[ImageContent],
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """Gemini Vision API 스트리밍"""
        system_instruction = None
        contents: list[types.Content] = []

        for m in messages:
            if m.role == "system":
                system_instruction = m.content
            elif m.role == "user" and images:
                # 멀티모달 컨텐츠 구성
                parts: list[types.Part] = []

                # 이미지 추가
                for img in images:
                    parts.append(types.Part.from_bytes(
                        data=__import__("base64").b64decode(img.data),
                        mime_type=img.media_type,
                    ))

                # 텍스트 추가
                parts.append(types.Part(text=m.content))

                contents.append(types.Content(role="user", parts=parts))
                # 이미지는 첫 번째 user 메시지에만 추가
                images = []
            else:
                role = "user" if m.role == "user" else "model"
                contents.append(types.Content(role=role, parts=[types.Part(text=m.content)]))

        # disable_thinking=True 시 thinking 비활성화 (Figma 모드 등 속도 우선)
        thinking_config = None if kwargs.get("disable_thinking") else self._thinking_config

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            thinking_config=thinking_config,
            temperature=0.5,
        )

        stream = await self.client.aio.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=config,
        )
        async for chunk in stream:
            # thinking 파트 제외하고 응답 텍스트만 스트리밍
            if chunk.candidates and chunk.candidates[0].content:
                for part in chunk.candidates[0].content.parts:
                    if part.text and not getattr(part, "thought", False):
                        yield part.text

    async def chat_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | list | None = None,
    ) -> ToolCallResponse:
        """Gemini tool calling (non-streaming)."""
        system_instruction = None
        contents: list[types.Content] = []

        for m in messages:
            if isinstance(m, dict):
                if m.get("role") == "system":
                    system_instruction = m.get("content", "")
                    continue
                contents.append(m)  # type: ignore[arg-type] — dict 또는 types.Content
            else:
                contents.append(m)

        # tool calling 시 thinking 비활성화 (thought_signature 호환 문제 방지)
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.5,
            tools=tools if tools else None,
        )

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=config,
        )

        parts = (
            response.candidates[0].content.parts
            if response.candidates and response.candidates[0].content
            else []
        )

        tool_calls: list[ToolCallData] = []
        text_content = ""

        for part in parts:
            if getattr(part, "thought", False):
                continue
            if part.function_call:
                fc = part.function_call
                tool_calls.append(ToolCallData(
                    id=fc.name,  # Gemini는 별도 ID 없음, name 사용
                    name=fc.name,
                    arguments=dict(fc.args) if fc.args else {},
                ))
            elif part.text:
                text_content += part.text

        return ToolCallResponse(
            content=text_content or None,
            tool_calls=tool_calls,
            raw_message=response,
        )

    async def chat_with_tools_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | list | None = None,
    ) -> AsyncGenerator[str, None]:
        """Gemini 최종 응답 스트리밍."""
        system_instruction = None
        contents: list[types.Content] = []

        for m in messages:
            if isinstance(m, dict):
                if m.get("role") == "system":
                    system_instruction = m.get("content", "")
                    continue
                contents.append(m)  # type: ignore[arg-type]
            else:
                contents.append(m)

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            thinking_config=self._thinking_config,
            temperature=0.5,
            # 최종 턴에서는 tools 제거하여 tool call 방지
        )

        stream = await self.client.aio.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=config,
        )
        async for chunk in stream:
            if chunk.candidates and chunk.candidates[0].content:
                for part in chunk.candidates[0].content.parts:
                    if part.text and not getattr(part, "thought", False):
                        yield part.text


def get_ai_provider() -> AIProvider:
    if settings.ai_provider == "anthropic":
        return AnthropicProvider()
    if settings.ai_provider == "gemini":
        return GeminiProvider()
    return OpenAIProvider()
