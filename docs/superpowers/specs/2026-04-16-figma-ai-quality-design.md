# Figma → AI 코드 생성 품질 개선 (메타 설계)

**날짜**: 2026-04-16
**범위**: `apps/ai-service/` 파이프라인 전반 (BE only)
**위치**: 메타 설계 — 하위 4개 sub-spec으로 분해됨

---

## 1. 목표

AI가 Figma 데이터로부터 React(DS) 코드를 생성할 때 발생하는 품질 문제를 파이프라인 수준에서 구조적으로 해결한다.

### 성공 기준 (우선순위)

1. **DS 컴포넌트 API 정확도 (최우선)** — 존재하지 않는 props, 잘못된 값 타입, 없는 컴포넌트/아이콘명 사용 0건에 수렴
2. **레이아웃 화면 재현도** — Figma 패널 구조·GridLayout 비율·TitleSection 배치 일치

### 관측된 문제 유형 (Board Detail 사례 기준)

- DS API 오용: `Checkbox value` 타입 혼동, `Option`에 없는 `helperText` props 주입 등
- 환각: 존재하지 않는 `Icon name="blank"`, 외부 이미지 URL 하드코딩
- 레이아웃 오해석: 실제 3:3:6 비율을 `GridLayout type="G"(2:2:8)`로 강제
- 구조 오배치: 다중 패널에서 `TitleSection`이 한 컬럼 안에 갇힘
- 수동 재조립: DatePicker 대신 `Field + Icon` 수동 조합, `Avatar` 대신 `div + bg-cover`

---

## 2. 아키텍처 (하이브리드 = 전처리 강화 + 경량 검증 1회)

```
[Figma API]
    │
    ▼
[S1] Preprocessing ──────── FigmaContext ──┐
    │                                        │
    ▼                                        │
[S2] Prompt Assembly ────── (sys, user) ────┤
    │                                        │
    ▼                                        │
[S3] AI Generation ──────── DraftCode ──────┤
    │                                        │
    ▼                                        │
[S4] Validation ─────── ValidationReport ───┤
    │                                        │
    ├── passed → return TSX                  │
    │                                        │
    └── failed (opt-in) → [S5] Repair (≤1회) ─┘
                                │
                                └── return (fixed or draft + report)
```

### 설계 원칙

- **단일 책임**: 각 단계는 하나의 역할만. `figma_simplify`는 정제만, 레이아웃 분석은 별도 모듈.
- **옵트인 롤아웃**: Validation/Repair는 feature flag로 단계적 활성화.
- **폴백 우선**: 어느 단계가 실패해도 최소한 1차 코드는 반환.
- **계측 가능**: 각 단계 latency + 오류 카테고리를 로그로 남겨 이후 개선 근거 확보.

---

## 3. 데이터 계약

### 3.1 FigmaContext (S1 → S2)

```python
@dataclass
class FigmaContext:
    simplified_json: dict              # 정제된 Figma 노드 트리 (좌표 포함)
    layout_hints: list[LayoutHint]
    component_matches: list[ComponentMatch]
    title_section: TitleSectionInfo | None
    warnings: list[str]                # 비표준 비율·누락 필드 등 이상징후

@dataclass
class LayoutHint:
    panel_path: str                    # 예: "root/content/main"
    widths: list[int]                  # [453, 453, 926]
    scaled_12: tuple[int, ...]         # (3, 3, 6)
    candidates: list[tuple[str, int]]  # [("E", 4), ("G", 4), ("F", 8)] — (type, distance)
    exact_match: str | None            # 정확 매치 없으면 None

@dataclass
class ComponentMatch:
    figma_node_id: str
    figma_name: str                    # e.g. "Checkbox/on"
    ds_component: str                  # e.g. "Checkbox"
    confidence: Literal["exact", "likely", "guess"]
    props_hint: dict                   # e.g. {"value": "checked"}

@dataclass
class TitleSectionInfo:
    present: bool
    recommended_placement: Literal["inside_grid_A", "outside_grid"]
    reason: str                        # 근거 설명
```

### 3.2 ValidationReport (S4 → S5)

```python
@dataclass
class ValidationReport:
    passed: bool
    errors: list[ValidationError]
    warnings: list[ValidationError]    # non-blocking

@dataclass
class ValidationError:
    category: Literal[
        "unknown_component",    # <Foo /> where Foo ∉ DS
        "invalid_prop",         # <Checkbox checked={...}> (실제 value="checked")
        "external_url",         # src="https://..."
        "unknown_icon",         # <Icon name="blank" />
        "missing_import",       # Chip 사용 but not imported
        "ast_parse_error",
    ]
    location: str               # "line 42, <Checkbox>"
    message: str
    suggested_fix: str | None   # 자동 수정 힌트
```

---

## 4. 단계별 책임 & 파일 매핑

| 단계 | 파일 | 상태 | 책임 |
|---|---|---|---|
| **S1 Preprocess — simplify** | `app/services/figma_simplify.py` | 기존, 슬림화 | Figma 노드 정제. 레이아웃 분석 로직은 분리 이관 |
| **S1 Preprocess — layout** | `app/services/semantic_layout.py` | **신규** | 패널 탐지·GridLayout 후보·TitleSection 배치 추천 |
| **S1 Preprocess — match** | `app/services/component_matcher.py` | **신규** | Figma 인스턴스명/variant → DS 컴포넌트 매핑 |
| **S2 Prompt — schema** | `app/api/components.py` | 기존, 리팩토링 | 정적 DS 규칙 스키마 관리 |
| **S2 Prompt — builder** | `app/services/prompt_builder.py` | **신규** | FigmaContext → system prompt·user message 조립 |
| **S3 Generate** | `app/services/tool_calling_loop.py` | 기존, 슬림화 | 1차 LLM 호출. Repair 책임 분리 |
| **S4 Validate** | `app/services/code_validator.py` | **신규** | AST/regex 검증. DS 스키마는 `component-schema.json` 재활용 |
| **S5 Repair** | `app/services/repair_loop.py` | **신규** | Validator 실패시 AI 재호출 (최대 1회) |
| **오케스트레이션** | `app/api/chat.py` 또는 `app/services/generation_pipeline.py` | 기존/신규 | 5단계 조립 |

---

## 5. 에러·재시도·폴백 정책

| 상황 | 동작 |
|---|---|
| S1 실패 (Figma 파싱 불가) | 힌트 없이 simplified JSON만 포함해 S2로 진행. 경고 로그 |
| S3 실패 (LLM 오류/timeout) | 기존 에러 처리 유지. 500 또는 재시도 |
| S4 통과 | 즉시 TSX 반환 |
| S4 실패 + repair 비활성 | 1차 코드 + `ValidationReport`를 응답 메타에 포함해 반환 |
| S4 실패 + repair 활성 + S5 성공 | 수정 코드 반환 |
| S4 실패 + S5도 실패 | 1차 코드 + `ValidationReport`를 메타에 포함 (silent failure 금지) |

### Feature flags (`app/core/config.py`)

- `ENABLE_VALIDATION: bool = False` — 기본 off, 단계적 on
- `ENABLE_REPAIR: bool = False` — Validation 성숙 후 on
- `VALIDATION_STRICT: bool = False` — true면 warning도 repair 트리거

### 관측성

- 각 단계별 latency metric
- `ValidationError.category` 별 카운터 로그
- Repair 성공/실패율

---

## 6. 서브 spec 분해 & 우선순위

| 순서 | Sub-spec | 이유 |
|---|---|---|
| **1** | `spec-validator`: Stage 4 Validator 도입 | 즉시 계측 가능 — 이후 모든 개선 효과 측정 기준 |
| **2** | `spec-preprocessing`: Stage 1 `semantic_layout` + `component_matcher` 분리·강화 | 레이아웃 재현도(2순위 목표) 직접 공략 |
| **3** | `spec-prompt-assembly`: Stage 2 `prompt_builder` 리팩토링 | 1,2 완료 후 힌트 주입 구조 정비 |
| **4** | `spec-repair-loop`: Stage 5 Repair 도입 | Validator 성숙 후에야 의미 있음 |

각 sub-spec은 별도 `brainstorming → writing-plans → implementing` 사이클.

---

## 7. 테스트 전략

- **골든 입력셋**: `apps/ai-service/layout/*.detail.json` (이미 캐시된 Figma 응답 재사용)
- **골든 출력셋**: `apps/ai-service/test_batch_output/`에 이미 쌓인 생성물로 validator 회귀 케이스 구축
- **단위 테스트**: 각 신규 모듈(`semantic_layout`, `component_matcher`, `code_validator`, `repair_loop`) 단독 테스트
- **파이프라인 e2e**: Figma JSON → 최종 TSX까지 통합 테스트 (모의 LLM 또는 snapshot)
- **회귀 지표**: `ValidationError.category` 별 발생률 추적 — 주차별/릴리즈별 감소 확인

---

## 8. 비기능 요구사항

- **latency**: 기본 경로(S4 통과)는 현재 대비 <+50ms. Repair 경로는 LLM 호출 1회 추가.
- **비용**: 평균 LLM 호출 수는 현재와 동일 (대부분 S4 통과 가정). Repair 경로만 ×2.
- **하위 호환**: 기존 API 응답 스키마 유지. `ValidationReport`는 optional 메타 필드로 추가.
- **BE only**: `apps/web/` 수정 없음.

---

## 9. 비범위 (Out of Scope)

- 프론트엔드 수정 없음 (`apps/web/` 변경 금지)
- 새로운 DS 컴포넌트 추가 없음
- Figma API 호출 로직 변경 없음 (이미 캐시 활용 중)
- 다른 디자인 툴 지원 확장 없음 (Figma 전용 유지)
- Contract-first(JSON→TSX 변환 레이어) 접근 제외 — 유연성 손실로 기각

---

## 10. 오픈 이슈 / 향후 결정

- Validator를 AST 기반으로 갈지(정확) regex 기반으로 갈지(빠름) — sub-spec에서 결정
- `component_matcher`의 신뢰도 기준 — exact/likely/guess 판별 휴리스틱 필요
- Repair 실패시 사용자에게 오류를 노출할지, 조용히 draft 반환할지 UX 결정 — 사용자 확인 필요
