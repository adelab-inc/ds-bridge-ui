from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from typing import Any

from anthropic import AsyncAnthropic
from google import genai
from google.genai import types
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.schemas.chat import Message

settings = get_settings()


class AIProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list[Message]) -> tuple[Message, dict | None]:
        pass

    @abstractmethod
    async def chat_stream(self, messages: list[Message]) -> AsyncGenerator[str, None]:
        pass


class OpenAIProvider(AIProvider):
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    async def chat(self, messages: list[Message]) -> tuple[Message, dict | None]:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
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
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class AnthropicProvider(AIProvider):
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model

    async def chat(self, messages: list[Message]) -> tuple[Message, dict | None]:
        system_message = ""
        chat_messages: list[dict[str, Any]] = []

        for m in messages:
            if m.role == "system":
                system_message = m.content
            else:
                chat_messages.append({"role": m.role, "content": m.content})

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_message if system_message else None,
            messages=chat_messages,
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
            max_tokens=4096,
            system=system_message if system_message else None,
            messages=chat_messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text


class GeminiProvider(AIProvider):
    def __init__(self):
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.gemini_model

    async def chat(self, messages: list[Message]) -> tuple[Message, dict | None]:
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
        )

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=config,
        )

        content = response.text or ""
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
        )

        async for chunk in self.client.aio.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=config,
        ):
            if chunk.text:
                yield chunk.text


def get_ai_provider() -> AIProvider:
    if settings.ai_provider == "anthropic":
        return AnthropicProvider()
    if settings.ai_provider == "gemini":
        return GeminiProvider()
    return OpenAIProvider()
