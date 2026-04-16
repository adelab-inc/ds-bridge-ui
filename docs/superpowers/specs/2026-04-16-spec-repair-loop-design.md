# Sub-Spec 4 — Repair Loop (Stage 5)

**Parent**: `2026-04-16-figma-ai-quality-design.md` (§6 순서 4)
**날짜**: 2026-04-16
**범위**: `apps/ai-service/` — 검증 실패 시 AI 재호출 자동 수정

---

## 1. 목적

Stage 4 Validator가 검출한 오류를 AI에게 피드백해 **1회 자동 수정**을 시도한다. 수정 성공 시 개선된 코드를 반환하고, 실패 시 1차 코드를 그대로 반환한다(silent failure 금지 — ValidationReport는 항상 첨부).

### 성공 기준

- Repair 후 ValidationReport.passed=True 비율 ≥70% (검증 실패 건 중)
- Repair가 기존 정상 코드를 망가뜨리지 않는다 (passed=True인 코드는 Repair 경로 진입 안 함)
- Repair 실패 시 1차 코드가 온전히 보존된다
- 전체 파이프라인 latency: Repair 경로는 기존 대비 +3~15초 (LLM 1회 추가 호출)

---

## 2. 범위

### In Scope

- `repair_code()` 함수: 1차 코드 + ValidationReport → AI 재호출 → 2차 코드 + 재검증
- Repair 전용 시스템 프롬프트 (에러 목록 구조화)
- Non-streaming `/chat` 엔드포인트 훅
- Feature flag `ENABLE_REPAIR` (기본 off, `ENABLE_VALIDATION=True` 필수 전제)
- 단위 테스트 + 통합 테스트

### Out of Scope

- Streaming `/chat/stream` 훅 (향후 별도 작업)
- 2회 이상 재시도 (v1은 최대 1회)
- Figma 컨텍스트 / 시스템 프롬프트 재전달 (코드 + 에러만 전달)
- Repair 프롬프트 자체의 A/B 테스트 프레임워크

---

## 3. 아키텍처

```
[S3] AI Generate → 1차 코드 (ParsedResponse)
    │
    ▼
[S4] validate_code() → ValidationReport
    │
    ├── passed=True → 그대로 반환
    │
    ├── passed=False + ENABLE_REPAIR=False
    │   → 1차 코드 + ValidationReport 반환 (현재 동작)
    │
    └── passed=False + ENABLE_REPAIR=True
         │
         ▼
        [S5] repair_code(source, report, provider)
         │
         ├── 2차 검증 passed=True → 수정 코드로 교체, 새 ValidationReport 첨부
         └── 2차 검증 passed=False → 1차 코드 유지, 원래 ValidationReport 첨부
```

### 설계 원칙

- **폴백 우선**: Repair는 best-effort. 실패해도 1차 결과는 보존
- **단일 책임**: `repair_loop.py`는 "AI에게 수정 요청 + 재검증"만 담당
- **옵트인**: `ENABLE_REPAIR=False` 기본. `ENABLE_VALIDATION=True` 전제
- **계측**: repair 시도/성공/실패 로그, latency 기록

---

## 4. 데이터 계약

### 4.1 RepairResult (S5 → chat.py)

```python
@dataclass
class RepairResult:
    success: bool              # 2차 검증 통과 여부
    code: str                  # 수정된 코드 (실패 시 원본)
    report: ValidationReport   # 2차 검증 리포트 (실패 시 1차 리포트)
    elapsed_ms: int            # repair 전체 소요 시간 (AI 호출 + 검증)
```

### 4.2 Repair 프롬프트 구조

```
System: "당신은 코드 수정 전문가입니다. 아래 TSX 코드에서 발견된 오류를 수정하세요.
        수정 시 기존 구조와 로직은 최대한 유지하고, 오류만 정확히 고치세요.
        전체 코드를 <file path="...">...</file> 형식으로 반환하세요."

User: "## 원본 코드\n```tsx\n{source}\n```\n\n## 검출된 오류\n{formatted_errors}"
```

에러 포맷팅 예시:
```
1. [missing_import] line 5, <Chip> — Chip used but not imported
   → 수정 힌트: add `import { Chip } from "@/components"`
2. [external_url] line 8 — external URL hardcoded: <img src="https://example.com/banner.png" />
   → 수정 힌트: 외부 URL 대신 placeholder box 또는 실제 자산 경로 사용
```

---

## 5. 파일 매핑

| 파일 | 변경 | 책임 |
|------|------|------|
| `app/services/repair_loop.py` | **신규** | `repair_code()` — AI 재호출 + 재검증 |
| `app/core/config.py` | 수정 | `enable_repair: bool = False` 추가 |
| `app/api/chat.py` | 수정 | `_maybe_validate_parsed` → `_maybe_validate_and_repair` 확장 |
| `app/schemas/chat.py` | 수정 없음 | `ParsedResponse.validation` 이미 존재 |
| `tests/test_repair_loop.py` | **신규** | 단위 + 통합 테스트 |

---

## 6. repair_code() 상세

```python
async def repair_code(
    source: str,
    report: ValidationReport,
    provider: AIProvider,
    catalog: ComponentCatalog,
) -> RepairResult:
    """검증 실패 코드를 AI에게 수정 요청. 최대 1회.

    Args:
        source: 1차 생성 TSX 코드
        report: 1차 검증 리포트 (errors가 있어야 의미 있음)
        provider: AI 프로바이더 (chat 메서드 사용)
        catalog: 컴포넌트 카탈로그 (재검증용)

    Returns:
        RepairResult — success=True면 수정 성공
    """
```

내부 흐름:
1. `report.errors`를 사람이 읽을 수 있는 문자열로 포맷팅
2. Repair 전용 system/user 메시지 조립
3. `await provider.chat(messages)` — AI 호출
4. 응답에서 코드 추출 (`parse_ai_response` 재사용)
5. `validate_code(repaired_code, catalog)` — 재검증
6. passed=True면 `RepairResult(success=True, code=repaired_code, ...)`
7. passed=False면 `RepairResult(success=False, code=source, report=원래report, ...)`

예외 발생 시:
- AI 호출 실패, 파싱 실패 등 → `RepairResult(success=False, code=source, report=원래report)`
- 로그에 경고 기록

---

## 7. chat.py 통합

### Non-streaming 변경

현재:
```python
parsed = parse_ai_response(response_message.content)
_maybe_validate_parsed(parsed)
```

변경 후:
```python
parsed = parse_ai_response(response_message.content)
await _maybe_validate_and_repair(parsed, provider)
```

`_maybe_validate_and_repair` 로직:
1. `ENABLE_VALIDATION=False` → return (아무것도 안 함)
2. validate → `passed=True` → `parsed.validation` 설정, return
3. `ENABLE_REPAIR=False` → `parsed.validation` 설정(실패 리포트), return
4. `ENABLE_REPAIR=True` → `repair_code()` 호출
5. repair 성공 → `parsed.files[i].content` 교체, `parsed.validation` 갱신
6. repair 실패 → `parsed.validation`에 1차 리포트 유지

### Streaming (향후)

현재 `_build_done_validation_payload`는 변경하지 않는다. Streaming repair는 별도 작업으로 분리.

---

## 8. Feature Flags

`app/core/config.py`에 추가:

```python
enable_repair: bool = False         # Repair 루프 활성화 (ENABLE_VALIDATION=True 전제)
```

조합 매트릭스:

| ENABLE_VALIDATION | ENABLE_REPAIR | 동작 |
|---|---|---|
| False | * | 검증/수정 모두 안 함 |
| True | False | 검증만 (현재 동작) |
| True | True | 검증 + 수정 1회 |

---

## 9. 에러·폴백 정책

| 상황 | 동작 |
|---|---|
| 1차 검증 통과 | Repair 진입 안 함, 즉시 반환 |
| Repair AI 호출 성공 + 2차 검증 통과 | 수정 코드 반환 |
| Repair AI 호출 성공 + 2차 검증 실패 | 1차 코드 + 1차 리포트 반환 |
| Repair AI 호출 실패 (timeout/error) | 1차 코드 + 1차 리포트 반환, 경고 로그 |
| Repair 코드 파싱 실패 | 1차 코드 + 1차 리포트 반환, 경고 로그 |

모든 실패 경로에서 **1차 코드가 보존**된다.

---

## 10. 관측성

- `repair_attempted`: repair 시도 횟수 (로그 카운터)
- `repair_succeeded`: 2차 검증 통과 횟수
- `repair_failed`: 2차 검증 실패 또는 예외
- `repair_elapsed_ms`: repair 전체 latency
- `repair_error_delta`: 1차 에러 수 vs 2차 에러 수 (개선 폭)

로그 형식:
```
logger.info("repair result", extra={
    "success": result.success,
    "elapsed_ms": result.elapsed_ms,
    "errors_before": len(original_report.errors),
    "errors_after": len(result.report.errors),
})
```

---

## 11. 테스트 전략

### 단위 테스트 (`tests/test_repair_loop.py`)

- `test_repair_success`: 모의 AI가 수정 코드 반환 → 재검증 통과 → success=True
- `test_repair_still_fails`: 모의 AI가 여전히 잘못된 코드 반환 → success=False, 원본 코드 보존
- `test_repair_ai_error`: 모의 AI가 예외 → success=False, 원본 코드 보존
- `test_repair_parse_error`: AI 응답이 파싱 불가 → success=False
- `test_error_formatting`: ValidationReport → 사람 읽기 좋은 문자열 변환
- `test_repair_prompt_structure`: system/user 메시지가 올바른 형식인지

### 통합 테스트 (`tests/test_code_validator.py` 확장)

- `test_validate_and_repair_flag_off`: ENABLE_REPAIR=False → repair 안 함
- `test_validate_and_repair_flag_on_success`: 모의 provider 사용, repair 성공 시 parsed.files 교체 확인
- `test_validate_and_repair_flag_on_failure`: repair 실패 시 1차 코드 유지 확인

---

## 12. 비기능 요구사항

- **latency**: Repair 경로는 LLM 1회 추가. 기존 3~15초에 +3~15초 예상
- **비용**: Repair 경로만 LLM 호출 ×2. 대부분 1차 통과 가정 시 평균 비용 증가 미미
- **하위 호환**: 기존 API 응답 스키마 변경 없음. `ValidationReport`는 이미 optional 메타
- **BE only**: `apps/web/` 수정 없음

---

## 13. 비범위

- Streaming 엔드포인트 repair (향후 별도)
- 2회 이상 재시도
- Figma 컨텍스트 / 원본 시스템 프롬프트 재전달
- Repair 프롬프트 A/B 테스트
- 프론트엔드 변경
