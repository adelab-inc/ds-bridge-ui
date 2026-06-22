# 설계: diff(search/replace) 기반 부분 코드 편집

- **작성일**: 2026-06-22
- **대상**: `apps/ai-service` (BE only)
- **상태**: 설계 승인됨 → spec 리뷰 1회 반영 완료

## 1. 배경 / 문제

런타임허브의 코드 수정은 매 요청마다 **현재 파일 전체를 프롬프트에 주입하고 "전체 코드를 빠짐없이 출력"** 시킨다. 누적 편집으로 파일이 비대해지면(실측 ~115KB):

- 출력 토큰이 **파일 크기에 비례(O(n))** → 5글자 수정에도 ~40k 토큰 재출력.
- 생성 ~300초, `max_output_tokens` 절단(MAX_TOKENS→no-code) 또는 broadcast 드레인 타임아웃.
- 상한 상향(#153)·broadcast 완화(#155)는 증상 완화일 뿐, **출력량 자체**가 근본 원인.

**목표**: 수정 시 모델이 **변경분만** 출력 → 출력 토큰이 변경량에 비례(O(변경분)).

## 2. 목표 / 비목표

**목표**
- 대형 파일 **텍스트 수정** 시 출력 토큰·생성시간·broadcast 부하를 변경량 수준으로 축소.
- **FE 무변경**: 서버가 패치를 적용해 전체 파일을 만들어 저장 → FE/미리보기/외부 API는 기존처럼 전체 파일을 받는다.
- 무중단 롤아웃(마스터 스위치, 기본 off).

**비목표 (diff 모드에서 제외 — 전체 모드 그대로)**
- 첫 생성(base 없음), 작은 파일.
- **Figma 모드**(`figma_url` 존재, `run_figma_tool_calling_loop` 경로) — tool-calling 루프라 별개.
- **Vision 모드**(`image_urls` 존재, `chat_vision_stream` 경로) — 별개 스트림.
- 파일 분할(멀티 파일), FE 스트리밍/미리보기 UX 재설계.

## 3. 확정된 설계 결정 (브레인스토밍 Q&A)

| 항목 | 결정 |
|---|---|
| 적용 범위 | **큰 파일 텍스트 수정만**. 작은 파일·첫 생성·figma·vision은 전체 모드 |
| 패치 포맷 | **Search/Replace 블록** (Aider 방식, 라인번호 불필요) |
| 매칭 실패 폴백 | **정확 → 퍼지(공백 정규화) → 실패 시 전체출력 재생성** |
| 롤아웃 | **마스터 스위치 `gemini_diff_edit_enabled`(기본 false)** |

## 4. 아키텍처 & 데이터 흐름

핵심: **diff는 모델↔서버 내부에서만.** 서버가 패치를 적용해 **전체 파일**을 만들고 이후 기존 저장/broadcast 경로 그대로 → FE 무변경.

### 4.1 diff_mode 판정 (chat_stream 엔드포인트에서 1회 결정)
`get_latest_code_message(room_id)`로 `base_code`를 **엔드포인트에서 1회 조회**하고 아래를 계산:
```
is_diff_mode =
    settings.gemini_diff_edit_enabled
    AND base_code is not None                       # 수정요청(기존 코드 존재)
    AND len(base_code["content"]) > THRESHOLD       # 문자열 길이 기준
    AND figma_url is None                            # figma 제외
    AND not is_vision_mode                           # vision 제외
```
`is_diff_mode`와 `base_code`(diff일 때만)를 아래 세 곳에 **함께 전달**한다.

### 4.2 배선(signature) 변경 — 명시
1. `resolve_system_prompt(..., diff_mode: bool = False)` — diff면 `<file>` 포맷 섹션 대신 **diff 포맷 섹션**을 시스템 프롬프트에 넣는다(§6). (현재 `RESPONSE_FORMAT_INSTRUCTIONS`가 `<file>`를 지시하므로 diff 모드에선 이걸 교체해야 충돌이 없음.)
2. `build_conversation_history(...)` → 반환을 `(messages, base_code | None)`로 변경하거나, 엔드포인트가 이미 조회한 `base_code`를 인자로 받아 사용. diff면 사용자 메시지의 "전체 코드 출력" 지시를 **diff 지시**(§6)로 교체. (양쪽 모드 모두 "현재 코드: `<file>…`" 주입은 유지 — 모델이 SEARCH 복사 출처.)
3. `_run_broadcast_generation(..., is_diff_mode: bool = False, base_code: dict | None = None)` — diff 분기(§4.3).
4. `StreamingParser.__init__(self, mode: str = "file")` — 현재 무인자 생성자에 `mode` 추가(§4.4).

> 현재 `build_conversation_history`(chat.py:309)는 `list[Message]`만 반환하고, `_run_broadcast_generation`(chat.py:1117)은 `base_code`를 받지 않으며, `StreamingParser.__init__`(chat.py:644)은 무인자다. 위 4개 시그니처 변경이 필수다.

### 4.3 diff 모드 생성 (`_run_broadcast_generation`)
```
1. 모델이 [짧은 설명 텍스트] + [<edit> search/replace 블록들] 스트리밍.
2. 파싱: StreamingParser를 diff 모드로 사용(§4.4) —
     - 첫 <edit 이전 텍스트 = chat → 기존처럼 라이브 broadcast.
     - <edit>…</edit> 블록(들) = patch_buffer에 누적, 코드 라이브 emit 안 함.
3. 스트림 종료 → edits = parse_edits(patch_buffer); full = apply_edits(base_code["content"], edits)
     - 성공 → collected_files = [{"path": base_code["path"], "content": full}]
       → 이후 기존 경로 그대로(DONE 저장 + done broadcast + #155 드레인).
     - PatchError → §8 폴백(전체출력 재생성).
4. diff 모드에서는 기존 no-code 재시도 루프(gemini_nocode_max_retries)와
   _extract_fenced_code 펜스 폴백을 사용하지 않는다(§4.5). 재시도는 §8 폴백이 담당.
```

### 4.4 파서 — StreamingParser diff 모드
`StreamingParser(mode="diff")`:
- `chat` 상태: `<edit` 등장 전 텍스트는 `chat` 이벤트로 emit(라이브). `<edit` 등장 시 그 이전을 chat으로 flush 후 `patch` 상태로 전환.
- `patch` 상태: 이후 모든 텍스트를 `patch_buffer`에 누적. **code/`<edit>` 이벤트를 emit하지 않는다**(라이브 broadcast 없음).
- `get_patch() -> str`: 누적된 patch_buffer 반환(생성 종료 후 호출).
- 즉 기존 `<file>` 경계 로직과 동형이되, 경계가 `<edit>`이고 코드 대신 patch_buffer에 담는다.

### 4.5 기존 흐름과의 상호작용
- diff 모드 분기는 기존 `for attempt in range(max_attempts)` no-code 루프 **밖**에서 단일 생성으로 수행한다(재시도는 §8 폴백이 대체).
- diff 모드에서 `_fire_and_forget_save`(중간 `<file>` 저장)는 **호출되지 않는다**. 근거: diff 생성은 출력이 작아 빠르므로(수초) 타임아웃 중간유실 위험이 낮고, 최종 `apply_edits` 후 1회 저장으로 충분. (의도된 결정)
- `_extract_fenced_code` 펜스 폴백은 diff 모드에서 비활성(패치 텍스트를 코드로 오회수하지 않도록).

### 4.6 안 바뀌는 것
첫 생성, 작은 파일, figma/vision, FE, DB 스키마, 응답 저장 형태(`content`=전체 파일), 외부 API/해시.

## 5. 패치 적용기 — `app/services/code_patch.py` (신규, 순수 함수)

```python
class PatchError(Exception):
    """파싱/적용 실패. message에 실패한 SEARCH 스니펫 포함."""

def parse_edits(text: str) -> list[tuple[str, str]]:
    """<edit path="...">  <<<<<<< SEARCH\n…\n=======\n…\n>>>>>>> REPLACE  </edit>
    → [(search, replace), ...] (path는 base_code 기준이라 무시 가능, 단일 파일).
    - 마커(SEARCH/=======/REPLACE) 누락·불완전 블록 → PatchError.
    - <edit> 블록이 0개 → PatchError(폴백 유도).
    """

def apply_edits(base: str, edits: list[tuple[str, str]]) -> str:
    """각 (search, replace)를 base에 순차 적용해 전체 파일 반환.
    각 블록:
      1) 정확 매칭: base.count(search)==1 → 치환.
      2) 0 또는 복수 → 퍼지 매칭(§5.1) → 유일하면 치환.
      3) 그래도 유일 매칭 실패(0/복수) → PatchError.
    앞 블록 결과 위에 다음 블록 적용(순차). 이미 치환돼 사라진 영역을 노리는
    뒤 블록은 매칭 실패 → PatchError → 폴백.
    """
```

### 5.1 퍼지 매칭 정의 (가장 위험한 단위 — 보수적으로)
- 정규화: **각 줄의 trailing whitespace 제거 + 줄 단위 비교**(줄바꿈 `\r\n`→`\n` 통일). 줄 내부 공백·들여쓰기는 보존(코드 의미 변경 방지).
- base를 줄 배열로, 정규화된 SEARCH 줄 시퀀스가 **연속으로 정확히 1회** 매칭되는 줄 범위를 찾는다.
- 매칭되면 **원본(정규화 전) 해당 줄 범위 전체**를 REPLACE로 치환(원본 영역 복원은 줄 인덱스로).
- 0개 또는 복수 매칭 → 실패(PatchError). 즉 "확실히 유일"할 때만 적용 — 모호하면 폴백.

## 6. 프롬프트 변경

두 출처를 **모두** diff용으로 바꿔야 충돌이 없다(리뷰 반영):
1. **시스템 프롬프트**: `RESPONSE_FORMAT_INSTRUCTIONS`(components.py, `generate_system_prompt`가 조립)는 `<file>` 출력을 지시한다. diff 모드에선 `resolve_system_prompt(diff_mode=True)`가 이 포맷 섹션을 **diff 포맷 섹션으로 대체**한다.
2. **사용자 메시지**: `build_conversation_history`의 "전체 코드를 빠짐없이 출력"(chat.py:376) 지시를 diff 지시로 교체.

diff 포맷 섹션 내용(요지):
> 변경된 부분만 아래 형식으로 출력하라. `<file>` 전체 출력 금지.
> ```
> <edit path="src/...">
> <<<<<<< SEARCH
> {현재 코드에서 공백·들여쓰기까지 그대로 복사한 스니펫 — 파일에서 유일하게 식별되도록 충분한 컨텍스트}
> =======
> {바뀐 스니펫}
> >>>>>>> REPLACE
> </edit>
> ```
> 변경 없는 부분은 출력 금지. 여러 곳이면 `<edit>` 블록을 여러 개. SEARCH는 반드시 현재 코드와 글자 그대로 일치해야 한다.

전체 모드(작은 파일·첫 생성·figma·vision) 프롬프트는 현행 유지.

## 7. 설정 (`config.py`)

둘 다 **신규 추가**(현재 config엔 `gemini_nocode_max_retries`/`gemini_max_output_tokens` 등만 존재):
- `gemini_diff_edit_enabled: bool = False` — 마스터 스위치(무중단 롤아웃).
- `gemini_diff_edit_threshold_chars: int = 24000` — diff 적용 임계. **`len(base_code["content"])`(파이썬 str 문자 길이) 기준** (≈8k 토큰, 한글 비중 따라 변동). dev 관측으로 튜닝.

## 8. 에러 처리 & 폴백

- `PatchError`(파싱 실패 / 매칭 실패) → **전체출력 재생성 1회**: 동일 요청을 **전체 모드**(diff_mode=False, 전체 포맷 프롬프트)로 재실행 → 기존 저장 경로(StreamingParser `<file>`).
- 재생성도 코드 0건 → 기존 no-code 가드(ERROR + error broadcast).
- 로깅/관측: 실패한 SEARCH 스니펫(앞 120자), diff 성공/폴백 횟수 → 운영에서 적중률 추적.

## 9. 테스트

- **단위** (`code_patch.py`):
  - `parse_edits`: 단일/복수 블록, 마커 누락·불완전 → PatchError, 0블록 → PatchError.
  - `apply_edits`: 정확 1회, 퍼지(trailing space 차이) 성공, 복수 매칭 → PatchError, 미발견 → PatchError, 순차 적용, "앞 블록이 지운 영역을 뒤 블록이 노림" → PatchError.
- **통합** (`_run_broadcast_generation`, mock provider):
  - diff 모드: search/replace 출력 → 서버가 전체 파일 생성·DONE 저장.
  - **diff 모드에서 `<edit>` 블록이 `chat`으로 broadcast되지 않음**(§4.3 step2 계약 검증).
  - PatchError → 전체출력 폴백 경로(전체 모드 재생성) → DONE.
  - 스위치 off / 작은 파일 / figma / vision → 전체 모드(기존 동작).
- **회귀**: 기존 chat/no-code/broadcast 테스트 통과.

## 10. 롤아웃

1. 스위치 off로 배포(무동작) → 단위/통합 통과 확인.
2. dev에서 `gemini_diff_edit_enabled=true` → 복구방(37af968f, 115KB) 실편집 검증(출력 토큰↓·시간↓·폴백률 관측).
3. 안정 확인 후 prod on.

## 11. 리스크 / 오픈 이슈

- 퍼지 매칭 오치환 → 정규화는 trailing space만(보수적), 모호하면 실패 처리(폴백).
- 모델이 SEARCH 부정확 복사 빈도 → 폴백률로 측정, 높으면 프롬프트 예시 강화.
- 임계값(24000) 적정성 → dev 관측 조정.
