# 설계: diff(search/replace) 기반 부분 코드 편집

- **작성일**: 2026-06-22
- **대상**: `apps/ai-service` (BE only)
- **상태**: 설계 승인됨 → spec 리뷰 대기

## 1. 배경 / 문제

런타임허브의 코드 수정은 매 요청마다 **현재 파일 전체를 프롬프트에 주입하고 "전체 코드를 빠짐없이 출력"** 시킨다 (`build_conversation_history`, `RESPONSE_FORMAT_INSTRUCTIONS`). 누적 편집으로 파일이 비대해지면(실측 ~115KB):

- 출력 토큰이 **파일 크기에 비례(O(n))** → 5글자 수정에도 ~40k 토큰 재출력.
- 생성 ~300초, `max_output_tokens` 상한 절단(MAX_TOKENS→no-code) 또는 broadcast 드레인 타임아웃.
- 상한 상향(#153)·broadcast 완화(#155)는 증상 완화일 뿐, **출력량 자체**가 근본 원인.

**목표**: 수정 시 모델이 **변경분만** 출력 → 출력 토큰이 변경량에 비례(O(변경분)) → 대형 파일도 빠르고 안정적으로 편집.

## 2. 목표 / 비목표

**목표**
- 대형 파일 수정 시 출력 토큰·생성시간·broadcast 부하를 변경량 수준으로 축소.
- **FE 무변경**: 서버가 패치를 적용해 전체 파일을 만들어 저장 → FE/미리보기/외부 API는 기존처럼 전체 파일을 받는다.
- 무중단 롤아웃(마스터 스위치, 기본 off).

**비목표**
- 첫 생성(base 없음)·작은 파일 동작 변경 (그대로 전체 출력).
- 파일 분할(멀티 파일) — 별도 건.
- FE 스트리밍/미리보기 UX 재설계.

## 3. 확정된 설계 결정 (브레인스토밍 Q&A)

| 항목 | 결정 | 근거 |
|---|---|---|
| 적용 범위 | **큰 파일만**(`len(base_code) > THRESHOLD`인 수정). 작은 파일·첫 생성은 전체 출력 유지 | 검증된 경로 무회귀, 위험한 대형만 새 경로 |
| 패치 포맷 | **Search/Replace 블록** (Aider 방식) | 라인번호 불필요 → 드리프트에 강함, 모델 친화적 |
| 매칭 실패 폴백 | **정확 매칭 → 퍼지(공백 정규화) → 실패 시 전체출력 재생성** | 적중률↑ + 실패 시에도 정확성 보장 |
| 롤아웃 | **마스터 스위치 `gemini_diff_edit_enabled`(기본 false)** | JWT처럼 무중단, 준비 후 on |

## 4. 아키텍처 & 데이터 흐름

핵심: **diff는 모델↔서버 내부에서만.** 서버가 패치를 적용해 **전체 파일**을 만들고, 이후는 기존 저장/broadcast 경로 그대로 → FE 무변경.

### 모드 분기 (`build_conversation_history`)
```
gemini_diff_edit_enabled AND 수정요청(base_code 존재) AND len(base_code) > THRESHOLD
   → [diff 모드]   프롬프트: search/replace 블록만 출력
그 외 (스위치 off / 첫 생성 / 작은 파일)
   → [전체 모드]   기존 그대로 (무회귀)
```
- 두 모드 모두 **현재 코드를 프롬프트에 주입**(모델이 SEARCH 복사 출처). diff 모드는 base_code를 호출부로 함께 반환(패치 적용용).

### diff 모드 생성 (`_run_broadcast_generation`)
```
1. 모델이 <edit> search/replace 블록 스트리밍 (출력 작음 = 빠름)
2. chat 텍스트는 라이브 broadcast(기존). 코드(패치)는 라이브 emit 안 하고 누적만.
3. 스트림 종료 → apply_edits(base_code, parse_edits(patch_text))
      exact → fuzzy → 실패 시 PatchError
4. 성공 → 전체 파일 완성 → collected_files[0]로 처리 → 기존 경로
      (DB DONE 저장 + done broadcast + #155 드레인 완화)
5. PatchError → 폴백: 전체 모드로 1회 재생성 → 기존 처리.
      재생성도 no-code면 기존 no-code 가드(ERROR).
```

### 안 바뀌는 것
첫 생성, 작은 파일, FE, DB 스키마, 응답 저장 형태(`content`=전체 파일), 외부 API/해시.

## 5. 패치 적용기 — `app/services/code_patch.py` (신규, 순수 함수)

```python
class PatchError(Exception): ...

def parse_edits(text: str) -> list[tuple[str, str]]:
    """<edit path="...">  <<<<<<< SEARCH … ======= … >>>>>>> REPLACE  </edit> → [(search, replace), ...]"""

def apply_edits(base: str, edits: list[tuple[str, str]]) -> str:
    """각 (search, replace)를 base에 순차 적용해 전체 파일 반환.
    - 정확 매칭: base에서 search 가 유일하게 발견되면 replace로 치환.
    - 0개/복수 → 퍼지 매칭(공백·들여쓰기 정규화 비교, 치환은 원본 영역).
    - 그래도 유일 매칭 실패 → PatchError(어느 블록 실패인지 포함).
    """
```
- 블록 여러 개면 순차 적용(앞 블록 결과 위에 다음 블록).
- 모호(복수 매칭)는 실패로 처리 → 모델이 더 많은 컨텍스트를 주도록 유도(폴백이 받침).
- 순수 함수 → 단위테스트 용이.

## 6. 프롬프트 변경 (`components.py` / `build_conversation_history`)

- diff 모드 전용 지시 블록: *"변경된 부분만 아래 형식으로 출력. SEARCH는 현재 코드에서 공백/들여쓰기까지 그대로 복사하고, 파일에서 유일하게 식별되도록 충분한 컨텍스트를 포함. 변경 없는 부분은 출력 금지. 여러 곳이면 `<edit>` 블록 여러 개."* + 포맷 예시.
- 전체 모드 지시(현행 "전체 코드 출력, 생략 금지")는 그대로 유지.
- 분기 지점에서 둘 중 하나만 주입.

## 7. 설정 (`config.py`)

- `gemini_diff_edit_enabled: bool = False` — 마스터 스위치(무중단 롤아웃).
- `gemini_diff_edit_threshold_chars: int = 24000` — diff 적용 임계(≈8k 토큰). 튜닝 가능.

## 8. 에러 처리 & 폴백

- `PatchError`(매칭 실패) → **전체출력 재생성 1회**(전체 모드 프롬프트로 동일 요청 재실행) → 기존 저장 경로.
- 재생성도 코드 0건 → 기존 no-code 가드(ERROR + error broadcast).
- 로깅/관측: 실패한 SEARCH 스니펫, diff 성공/폴백 횟수(운영에서 적중률 추적).

## 9. 테스트

- **단위** (`code_patch.py`): parse_edits(단일/복수/경계), apply_edits(정확/퍼지/복수블록/모호실패/미발견실패), PatchError 메시지.
- **통합** (`_run_broadcast_generation`): mock provider가 search/replace 출력 → 서버가 전체 파일 생성·DONE 저장. PatchError → 전체출력 폴백 경로. 스위치 off면 전체 모드.
- **회귀**: 작은 파일/첫 생성은 전체 모드 그대로, 기존 테스트 통과.

## 10. 롤아웃

1. 스위치 off로 배포(무동작) → 단위/통합 테스트 통과 확인.
2. dev에서 `gemini_diff_edit_enabled=true` → 복구방(37af968f, 115KB)으로 실편집 검증(출력 토큰↓·시간↓·폴백률 관측).
3. 안정 확인 후 prod on.

## 11. 리스크 / 오픈 이슈

- 퍼지 매칭이 잘못된 영역을 치환할 위험 → 정규화는 보수적으로(공백만), 모호하면 실패 처리(폴백).
- 모델이 SEARCH를 부정확히 복사하는 빈도 → 폴백률로 측정, 높으면 프롬프트 강화/예시 추가.
- 임계값(24000) 적정성 → dev 관측으로 조정.
