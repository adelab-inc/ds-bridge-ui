import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from typing import Any

from anthropic import AsyncAnthropic
from google import genai
from google.genai import types
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.schemas.chat import ImageContent, Message

settings = get_settings()
logger = logging.getLogger(__name__)


# 정상 종료로 간주하는 finish_reason. MAX_TOKENS(출력 잘림)는 비정상으로 격상해 관측한다
# (그 외 RECITATION/SAFETY/OTHER 등도 비정상).
_NORMAL_FINISH_REASONS = {"STOP", "FINISH_REASON_UNSPECIFIED"}


def _check_gemini_finish(response_or_chunk: Any) -> None:
    """Gemini 종료 신호(finish_reason)·프롬프트 차단·usage(thinking 토큰)를 로깅.

    - RECITATION/SAFETY 등 비정상 종료, MAX_TOKENS(출력 잘림) → WARNING.
    - finish_reason이 실린 청크에서 usage_metadata(thoughts/candidates 토큰)도 함께 로깅 →
      thinking 폭주(정상 ~2k → 60k+)로 인한 MAX_TOKENS 절단을 운영 로그만으로 식별 가능.
    recitation 환각처럼 모델이 작업을 이탈해도 text는 정상으로 흘러 서버가 모르고 저장하는
    것을 막기 위한 관측 지점. 로깅 실패가 스트림을 깨면 안 되므로 모든 예외는 무시한다.
    """
    try:
        fb = getattr(response_or_chunk, "prompt_feedback", None)
        block_reason = getattr(fb, "block_reason", None) if fb is not None else None
        if block_reason:
            logger.warning("Gemini prompt blocked", extra={"block_reason": str(block_reason)})
        for cand in getattr(response_or_chunk, "candidates", None) or []:
            fr = getattr(cand, "finish_reason", None)
            if fr is None:
                continue
            name = getattr(fr, "name", str(fr))
            usage = getattr(response_or_chunk, "usage_metadata", None)
            extra: dict[str, Any] = {"finish_reason": name}
            if usage is not None:
                extra["thoughts_tokens"] = getattr(usage, "thoughts_token_count", None)
                extra["candidates_tokens"] = getattr(usage, "candidates_token_count", None)
                extra["total_tokens"] = getattr(usage, "total_token_count", None)
            if name == "MAX_TOKENS":
                logger.warning(
                    "Gemini output truncated (MAX_TOKENS) — likely thinking overflow", extra=extra
                )
            elif name not in _NORMAL_FINISH_REASONS:
                logger.warning("Gemini abnormal finish_reason", extra=extra)
            else:
                logger.info("Gemini finish", extra=extra)
    except Exception:
        logger.debug("finish_reason check failed", exc_info=True)


class AIProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list[Message], **kwargs: Any) -> tuple[Message, dict | None]:
        pass

    @abstractmethod
    async def chat_stream(self, messages: list[Message]) -> AsyncGenerator[str, None]:
        pass

    async def chat_vision_stream(
        self,
        messages: list[Message],
        images: list[ImageContent],
    ) -> AsyncGenerator[str, None]:
        """Vision API 스트리밍 (기본: 미지원)"""
        raise NotImplementedError("Vision not supported by this provider")
        yield  # Generator 타입 힌트용


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

    async def chat_stream(self, messages: list[Message]) -> AsyncGenerator[str, None]:
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

    async def chat_stream(self, messages: list[Message]) -> AsyncGenerator[str, None]:
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


# ⚠️ "off"는 None → thinking_config 미전달 → Gemini 3은 기본 dynamic thinking(ON)으로 동작한다.
#    즉 "off"는 thinking을 끄지 못한다(폭주 위험). 실제로 줄이려면 "minimal"/"low"를 명시하라.
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
            max_output_tokens=settings.gemini_max_output_tokens,
        )

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=config,
        )
        _check_gemini_finish(response)

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

    async def chat_stream(self, messages: list[Message]) -> AsyncGenerator[str, None]:
        system_instruction = None
        contents: list[types.Content] = []

        for m in messages:
            if m.role == "system":
                system_instruction = m.content
            else:
                role = "user" if m.role == "user" else "model"
                contents.append(types.Content(role=role, parts=[types.Part(text=m.content)]))

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            thinking_config=self._thinking_config,
            temperature=0.5,
            max_output_tokens=settings.gemini_max_output_tokens,
        )

        stream = await self.client.aio.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=config,
        )
        async for chunk in stream:
            _check_gemini_finish(chunk)
            # thinking 파트 제외하고 응답 텍스트만 스트리밍
            if chunk.candidates and chunk.candidates[0].content:
                for part in chunk.candidates[0].content.parts:
                    if part.text and not getattr(part, "thought", False):
                        yield part.text

    async def chat_vision_stream(
        self,
        messages: list[Message],
        images: list[ImageContent],
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

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            thinking_config=self._thinking_config,
            temperature=0.5,
            max_output_tokens=settings.gemini_max_output_tokens,
        )

        stream = await self.client.aio.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=config,
        )
        async for chunk in stream:
            _check_gemini_finish(chunk)
            # thinking 파트 제외하고 응답 텍스트만 스트리밍
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
