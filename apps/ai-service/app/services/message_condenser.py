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
사용자가 보낸 긴 화면 요구사항 문서에서 **UI 코드를 만들 때 직접 필요한 정보만** 남기세요.

## 반드시 보존 (절대 제거 금지 — 한 글자도 바꾸지 말 것)
- 화면명 및 목적
- 레이아웃 구조 (섹션, 영역 배치)
- 입력 항목 테이블 전체: 이름, 유형(Text(4), Select 등), 필수, 형식, 비고 — 행/열 그대로
- 그리드/목록 컬럼 테이블 전체: 표시명, DB 컬럼, 타입, 형식, 정렬, 필터 — 행/열 그대로
- 버튼 정의: 이름, 동작, 크기, 스타일 — 예: "**조회** (md, primary): 설명" 형태 그대로
- 다이얼로그/모달 구조
- 유효성 검증 규칙, 상태별 UI 변화
- 인터랙션 흐름 (클릭 → 결과, 토스트 메시지 텍스트)
- 드롭다운 선택지, 코드값 매핑
- 업무 흐름도 (화면 맥락 이해용)

## 반드시 제거
- "데이터 구조", "DB 스키마" 섹션 전체 (테이블 정의, 컬럼 목록, FK 관계 등)
  → UI에 필요한 컬럼명은 이미 그리드/입력 항목 테이블에 있으므로 중복
- API 엔드포인트 경로 및 JSON 응답 전문
- AS-IS/TO-BE 비교 논의
- 회의록 원문, 참고자료, 히스토리
- 개선 제안, TODO, 향후 계획
- 동일 내용의 반복
- "현업 요청사항" 중 "없음", "검색 중..." 등 내용이 없는 항목

## 출력 규칙
- 보존 대상은 원문 그대로 출력 (요약/재구성/보충 금지)
- 원문에 없는 내용을 절대 추가하지 말 것
- 제거한 부분에 "[생략]" 같은 표시를 넣지 말 것
- 한국어로 출력"""

# Provider별 경량 모델 매핑
LITE_MODELS = {
    "openai": "gpt-4.1-nano",
    "anthropic": "claude-haiku-4-5-20251001",
    "gemini": "gemini-2.5-flash-lite",
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
    logger.debug(
        "Condensed message content",
        extra={"condensed_content": result},
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
