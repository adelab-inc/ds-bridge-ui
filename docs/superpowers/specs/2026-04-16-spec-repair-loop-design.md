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
- Figma 컨텍스트 / 원본 시스템 프롬프트 재전달 (코드 + 에러 + DS 컴포넌트 이름만 전달)
- Repair 프롬프트 자체의 A/B 테스트 프레임워크

---

## 3. 아키텍처

```
[S3] AI Generate → 1차 코드 (ParsedResponse.files: list[FileContent])
    │
    ▼
[S4] validate_code() per file → merged ValidationReport
    │
    ├── passed=True → 그대로 반환
    │
    ├── passed=False + ENABLE_REPAIR=False
    │   → 1차 파일 + ValidationReport 반환 (현재 동작)
    │
    └── passed=False + ENABLE_REPAIR=True
         │
         ▼
        [S5] repair_code(files, report, provider, catalog)
         │   (모든 파일을 <file> 블록으로 합쳐 단일 AI 호출)
         │
         ├── 2차 검증 passed=True → 수정 파일로 교체, 새 ValidationReport 첨부
         └── 2차 검증 passed=False → 1차 파일 유지, 원래 ValidationReport 첨부
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
from app.schemas.chat import FileContent

@dataclass
class RepairResult:
    success: bool                  # 2차 검증 통과 여부
    files: list[FileContent]       # 수정된 파일 목록 (실패 시 원본 파일 목록)
    report: ValidationReport       # 2차 검증 리포트 (실패 시 1차 리포트)
    elapsed_ms: int                # repair 전체 소요 시간 (AI 호출 + 검증)
```

`RepairResult`는 `@dataclass`를 사용한다 (API 응답으로 직렬화되지 않는 내부 전용 타입이므로 Pydantic `BaseModel` 불필요).

**다중 파일 전략**: `ParsedResponse.files`는 `list[FileContent]`이므로, repair 시 모든 파일을 `<file path="...">content</file>` 형태로 합쳐서 단일 AI 호출로 전달한다. AI 응답을 `parse_ai_response`로 재파싱하여 파일 목록을 추출한다. `parse_ai_response`는 기존 `_postprocess_code()`를 자동 적용하므로, 수정 코드에도 아이콘 크기/뷰포트 후처리가 적용된다.

### 4.2 Repair 프롬프트 구조

```
System: "당신은 코드 수정 전문가입니다. 아래 TSX 코드에서 발견된 오류를 수정하세요.
        수정 시 기존 구조와 로직은 최대한 유지하고, 오류만 정확히 고치세요.
        수정 여부와 관계없이 모든 파일을 <file path="...">...</file> 형식으로 반환하세요.
        오류가 없는 파일도 원본 그대로 포함해야 합니다.

        ## 사용 가능한 DS 컴포넌트
        {component_names}
        위 컴포넌트는 `import { ComponentName } from \"@/components\"` 로 사용합니다."

User: "## 원본 코드\n{file_blocks}\n\n## 검출된 오류\n{formatted_errors}"
```

**컴포넌트 목록**: `ComponentCatalog.get_names()`에서 DS 컴포넌트 이름을 추출한다 (`REACT_BUILTINS` 제외 — `Fragment`, `React` 등은 DS 컴포넌트가 아님). 쉼표 구분 문자열로 포맷. 이를 통해 AI가 `missing_import` / `unknown_component` 에러를 올바르게 수정할 수 있다.

**파일 블록 구성**: `parsed.files`의 각 `FileContent`를 `<file path="{path}">\n{content}\n</file>` 형태로 합친다 (1차 AI 응답과 동일한 포맷).

**에러 파일 귀속**: 다중 파일 시 각 에러를 해당 파일 경로와 함께 그룹핑한다. `_maybe_validate_and_repair`에서 파일별 `validate_code()` 결과를 머지할 때, 각 `ValidationError.location`에 파일 경로를 접두사로 추가한다 (예: `"src/pages/Detail.tsx: line 5, <Chip>"`). `format_errors_for_repair()`에서 에러를 파일별로 그룹핑하여 포맷한다.

에러 포맷팅 예시 (단일 파일):
```
## src/pages/Login.tsx
1. [missing_import] line 5, <Chip> — Chip used but not imported
   → 수정 힌트: add `import { Chip } from "@/components"`
2. [external_url] line 8 — external URL hardcoded: <img src="https://example.com/banner.png" />
   → 수정 힌트: 외부 URL 대신 placeholder box 또는 실제 자산 경로 사용
```

에러 포맷팅 예시 (다중 파일):
```
## src/pages/Login.tsx
1. [missing_import] line 5, <Chip> — Chip used but not imported
   → 수정 힌트: add `import { Chip } from "@/components"`

## src/pages/Detail.tsx
1. [external_url] line 12 — external URL hardcoded: <img src="https://example.com/banner.png" />
   → 수정 힌트: 외부 URL 대신 placeholder box 또는 실제 자산 경로 사용
```

**누락 파일 방지**: 시스템 프롬프트에 "수정 여부와 관계없이 모든 파일을 반환하세요"를 명시한다. 추가 안전장치로 `repair_code()` 내부에서 AI 응답의 파일 목록이 원본보다 적으면 원본에서 누락된 파일을 보충(backfill)한다.

---

## 5. 파일 매핑

| 파일 | 변경 | 책임 |
|------|------|------|
| `app/services/repair_loop.py` | **신규** | `repair_code()` — AI 재호출 + 재검증 |
| `app/services/code_validator.py` | 수정 | `ComponentCatalog.get_names() -> set[str]` 추가 (DS 전용, `REACT_BUILTINS` 제외) |
| `app/core/config.py` | 수정 | `enable_repair: bool = False` 추가 |
| `app/api/chat.py` | 수정 | `_maybe_validate_parsed`(동기) → `_maybe_validate_and_repair`(async) 교체 |
| `app/schemas/chat.py` | 수정 없음 | `ParsedResponse.validation` 이미 존재 |
| `tests/test_repair_loop.py` | **신규** | 단위 + 통합 테스트 |

---

## 6. repair_code() 상세

```python
async def repair_code(
    files: list[FileContent],
    report: ValidationReport,
    provider: AIProvider,
    catalog: ComponentCatalog,
) -> RepairResult:
    """검증 실패 코드를 AI에게 수정 요청. 최대 1회.

    Args:
        files: 1차 생성 파일 목록 (ParsedResponse.files)
        report: 1차 검증 리포트 (errors가 있어야 의미 있음)
        provider: AI 프로바이더 (chat 메서드 사용)
        catalog: 컴포넌트 카탈로그 (재검증 + 컴포넌트 이름 추출용)

    Returns:
        RepairResult — success=True면 수정 성공
    """
```

내부 흐름:
1. `files`를 `<file path="...">content</file>` 형태의 문자열로 조립
2. `catalog`에서 DS 컴포넌트 이름 목록 추출
3. `report.errors`를 사람이 읽을 수 있는 문자열로 포맷팅
4. Repair 전용 system/user 메시지 조립 (컴포넌트 목록 포함)
5. `await provider.chat(messages)` — AI 호출
6. 응답에서 파일 추출 (`parse_ai_response` 재사용 → `ParsedResponse`)
7. 각 파일에 대해 `validate_code(file.content, catalog)` — 재검증, 결과 머지
8. passed=True면 `RepairResult(success=True, files=repaired_files, ...)`
9. passed=False면 `RepairResult(success=False, files=원본files, report=원래report, ...)`

**성공 판단 (v1)**: 2차 검증 결과 `ValidationReport.passed=True` (에러 0건)인 경우만 성공. 에러 수가 줄었더라도 `passed=False`면 실패 처리한다. 부분 개선(partial success)은 v1에서 고려하지 않는다.

예외 발생 시:
- AI 호출 실패, 파싱 실패 등 → `RepairResult(success=False, files=원본files, report=원래report)`
- 로그에 경고 기록

---

## 7. chat.py 통합

### Non-streaming 변경

현재:
```python
parsed = parse_ai_response(response_message.content)
_maybe_validate_parsed(parsed)  # 동기 함수
```

변경 후:
```python
parsed = parse_ai_response(response_message.content)
await _maybe_validate_and_repair(parsed, provider)  # async 함수
```

기존 `_maybe_validate_parsed`(동기)를 `_maybe_validate_and_repair`(async)로 **교체**한다. `provider.chat()` 호출이 async이므로 `async def` 필수.

`_maybe_validate_and_repair` 로직:
1. `ENABLE_VALIDATION=False` → return (아무것도 안 함)
2. 각 `parsed.files`에 대해 `validate_code()` 실행, 결과 머지 → `merged_report`
3. `merged_report.passed=True` → `parsed.validation = merged_report`, return
4. `ENABLE_REPAIR=False` → `parsed.validation = merged_report`, return
5. `ENABLE_REPAIR=True` → `await repair_code(parsed.files, merged_report, provider, _CODE_CATALOG)` 호출 (모듈 레벨 싱글톤 재사용)
6. repair 성공 → `parsed.files`를 `result.files`로 교체, `parsed.validation = result.report`
7. repair 실패 → `parsed.validation = merged_report` (1차 리포트 유지, 1차 파일 유지)

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
- `test_repair_multi_file`: 2개 파일 중 1개만 에러 → 모든 파일이 AI에 전달되고, 결과도 2개 파일 포함
- `test_repair_backfill_missing_files`: AI가 일부 파일만 반환 시 원본에서 누락 파일 보충 확인

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
- Figma 컨텍스트 / 원본 시스템 프롬프트 재전달 (DS 컴포넌트 이름 목록은 포함)
- Repair 프롬프트 A/B 테스트
- 프론트엔드 변경
