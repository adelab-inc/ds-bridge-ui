"""JSON 구조화 로깅 설정"""

import logging
import sys
from datetime import datetime, timezone

from pythonjsonlogger.json import JsonFormatter as BaseJsonFormatter


class CustomJsonFormatter(BaseJsonFormatter):
    """커스텀 JSON 포맷터 - 추가 필드 포함"""

    def add_fields(
        self,
        log_record: dict,
        record: logging.LogRecord,
        message_dict: dict,
    ) -> None:
        super().add_fields(log_record, record, message_dict)

        # 타임스탬프 (ISO 8601)
        log_record["timestamp"] = datetime.now(timezone.utc).isoformat()

        # 레벨
        log_record["level"] = record.levelname

        # 로거 이름
        log_record["logger"] = record.name

        # 소스 위치
        log_record["source"] = f"{record.filename}:{record.lineno}"

        # 함수명
        if record.funcName:
            log_record["function"] = record.funcName


def setup_logging(level: str = "INFO") -> None:
    """
    애플리케이션 전체 로깅 설정

    Args:
        level: 로그 레벨 (DEBUG, INFO, WARNING, ERROR)
    """
    # 루트 로거 설정
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))

    # 기존 핸들러 제거
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # JSON 포맷터 설정
    formatter = CustomJsonFormatter(
        fmt="%(timestamp)s %(level)s %(name)s %(message)s",
        rename_fields={"levelname": "level", "name": "logger"},
    )

    # stdout 핸들러 추가
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # 외부 라이브러리 로그 레벨 조정
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("google").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    # uvicorn 로거도 JSON 포맷터 적용
    for uvicorn_logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
        uvicorn_logger = logging.getLogger(uvicorn_logger_name)
        uvicorn_logger.handlers = []
        uvicorn_logger.addHandler(handler)
