"""
메시지 압축 서비스 — 긴 요구사항 문서를 경량 모델로 UI 코드 생성용으로 압축
"""

import logging

from anthropic import AsyncAnthropic
from google import genai
from google.genai import types
from openai import AsyncOpenAI

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

CONDENSE_SYSTEM_PROMPT = """당신은 UI 코드 생성용 요구사항 정리 전문가입니다.
사용자가 보낸 긴 화면 요구사항 문서를 읽고, UI 코드 생성에 필요한 핵심 정보만 추출하여 정리하세요.

## 보존해야 할 정보
- 화면명 및 목적
- 전체 레이아웃 구조 (섹션, 영역 배치)
- 입력 항목 (이름, 유형, 필수 여부, 선택지)
- 그리드/테이블 컬럼 정의 (헤더명, 데이터 타입, 너비, 정렬)
- 버튼 (이름, 동작, 위치)
- 다이얼로그/모달 구조와 내용
- 유효성 검증 규칙
- 상태별 UI 변화 (조건부 표시/비활성화)
- 인터랙션 흐름 (클릭 → 결과)

## 제거해야 할 정보
- DB 테이블/컬럼 상세 (타입, 크기, 제약조건)
- API 엔드포인트 경로 및 JSON 응답 전문
- AS-IS/TO-BE 비교 논의
- 회의록, 참고자료, 히스토리
- 개선 제안, TODO, 향후 계획
- 반복되는 설명이나 중복 내용

## 출력 규칙
- 원문의 구조를 유지하되 불필요한 부분을 제거
- 항목 목록은 간결하게 유지 (한 줄에 하나)
- 원문에 없는 내용을 추가하지 말 것
- 한국어로 출력"""

# Provider별 경량 모델 매핑
LITE_MODELS = {
    "openai": "gpt-4.1-nano",
    "anthropic": "claude-haiku-4-5-20251001",
    "gemini": "gemini-2.0-flash-lite",
}


async def condense_message(message: str, threshold: int = 0) -> str:
    """
    threshold 초과 시 경량 모델로 UI 코드 생성용 압축.

    - threshold=0이면 settings.condense_threshold 사용
    - threshold 이하: 원본 반환
    - 압축 실패: 원본 반환 (폴백)
    - 압축 결과가 원본보다 길면: 원본 반환
    """
    if threshold <= 0:
        threshold = settings.condense_threshold

    if len(message) <= threshold:
        return message

    logger.info(
        "Message condensing triggered",
        extra={"original_length": len(message), "threshold": threshold},
    )

    try:
        result = await _call_lite_model(message)
    except Exception:
        logger.warning("Message condensing failed, using original", exc_info=True)
        return message

    if len(result) >= len(message):
        logger.info(
            "Condensed message not shorter, using original",
            extra={"original_length": len(message), "condensed_length": len(result)},
        )
        return message

    logger.info(
        "Message condensed successfully",
        extra={
            "original_length": len(message),
            "condensed_length": len(result),
            "ratio": f"{len(result) / len(message) * 100:.0f}%",
        },
    )
    return result


async def _call_lite_model(message: str) -> str:
    """현재 AI provider에 맞는 경량 모델 호출"""
    provider = settings.ai_provider
    model = LITE_MODELS[provider]

    if provider == "openai":
        return await _call_openai(model, message)
    elif provider == "anthropic":
        return await _call_anthropic(model, message)
    else:
        return await _call_gemini(model, message)


async def _call_openai(model: str, message: str) -> str:
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": CONDENSE_SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ],
        temperature=0,
    )
    return response.choices[0].message.content or message


async def _call_anthropic(model: str, message: str) -> str:
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model=model,
        max_tokens=8192,
        system=CONDENSE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": message}],
        temperature=0,
    )
    return response.content[0].text if response.content else message


async def _call_gemini(model: str, message: str) -> str:
    client = genai.Client(api_key=settings.gemini_api_key)
    response = await client.aio.models.generate_content(
        model=model,
        contents=f"{CONDENSE_SYSTEM_PROMPT}\n\n---\n\n{message}",
        config=types.GenerateContentConfig(temperature=0),
    )
    return response.text or message
