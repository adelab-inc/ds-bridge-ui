# AI 시스템 프롬프트(components.py) 개선 작업 요약

> 작업일: 2026-03-23
> 브랜치: `test/sync-verification`
> 대상 파일: `apps/ai-service/app/api/components.py`

## 배경

`storybook-standalone`에서 UI 라이브러리를 동기화(커밋 d537869)한 후, AI 코드 생성 서비스(`apps/ai-service`)의 시스템 프롬프트가 실제 컴포넌트 API와 불일치하는 문제를 발견하여 단계적으로 수정했습니다.

테스트 프롬프트("영수증관리 페이지")로 4차에 걸쳐 코드 생성 → 렌더링 캡처 → 검증 → 수정 사이클을 반복했습니다.

---

## 커밋 6bb3b4e1d — Story 파일 기반 AI 프롬프트 자동 삽입

> 커밋: `6bb3b4e1d` | 6 files, +760 insertions

Storybook story 파일에서 컴포넌트별 사용 예시를 빌드 타임에 추출하여 AI 시스템 프롬프트에 자동 삽입하는 파이프라인 구축.

| 수정 | 내용 |
|------|------|
| `extract-story-examples.ts` 신규 | types.ts enum 직접 import로 역매핑 자동 구축, 15개 화이트리스트 컴포넌트의 args/variants/compound pattern 추출 |
| `components.py` | `load_story_examples()`, `format_story_examples()` 함수 추가 |
| `story-examples.json` 생성 | 추출된 컴포넌트별 사용 예시 JSON (236줄) |
| Dockerfile / deploy.sh | story-examples.json 복사 경로 추가 |

---

## 커밋 a3324097 — components.py UI 동기화 반영 (sync-diff-d537869 기준)

> 커밋: `a3324097` | 2 files, +245/-147

동기화된 UI 라이브러리의 Breaking Changes를 AI 시스템 프롬프트에 전면 반영.

| 수정 | 내용 |
|------|------|
| 화이트리스트 | Pagination 제거, ActionBar/FilterBar/LabelValue/TitleSection/Popover/FieldGroup/IconButton 추가 |
| Breaking Changes 반영 | `variant` → `buttonType`, `children` → `label`, `disabled`/`isDisabled` → `interaction` prop 통합 |
| Discriminated Union 패턴 | Field/Select에 `showLabel`/`showHelptext` 필수 지정 규칙 추가 |
| UI 패턴 예시 교체 | FilterBar/ActionBar/TitleSection 컴포넌트 활용 예시로 전면 교체 |
| 체크리스트 | buttonType 검증, Discriminated Union 검증, interaction 검증, Button label 검증 (4항목 추가) |
| `app/schemas/chat.py` | Button 예시 `variant`/`children` → `buttonType`/`label` 수정 |

---

## 1차: Icon 사용 규칙 정비

**문제**: "NO ICONS AT ALL" 전면 금지 규칙과, IconButton/ActionBar 예시에서 `<Icon>` 사용이 모순

| 수정 | 내용 |
|------|------|
| WHITELIST | `"Icon"` 추가 |
| Button 섹션 | `showStartIcon/showEndIcon` 아이콘 있을 때 사용법 + size별 Icon size 매핑 |
| Icon 가이드 신설 | size별 사용 가능 name 목록 (16→21종, 20→56종, 24→22종), 용도별 권장 아이콘 |
| Images & Icons 재작성 | 외부 라이브러리 금지 유지, `Icon` 컴포넌트 허용, "텍스트 전용" 규칙 삭제 |
| NO EXTERNAL LIBS | "use text only" → "Icon 컴포넌트만 사용" |
| 체크리스트 #12 | Icon name 유효성 + 외부 라이브러리 미사용 검증 |

---

## 2차: 1차 테스트 검증 결과 반영 (Badge/Dialog/Field)

**문제**: 테스트 프롬프트로 생성한 코드의 Badge 색상이 모두 동일 → `statusVariant`(존재하지 않는 prop) 사용

| 수정 | 내용 |
|------|------|
| Badge 섹션 재작성 | `statusVariant` → `status` prop (Discriminated Union 패턴 전체 문서화) |
| Dialog.Footer 예시 | 불필요한 `<div className="flex ...">` wrapper 제거 (2곳) |
| Field multiline 추가 | `rowsVariant` 문서화 (flexible/rows4/rows6/rows8) + multiline 시 icon 제한 |
| 체크리스트 #13 | Badge `statusVariant` 미사용 검증 |

---

## 3차: 2차 테스트 검증 결과 반영 (DataGrid/Tag/LabelValue)

**문제**: Badge 색상은 정상화됐으나, DataGrid에 큰 빈 공간 + Tag/LabelValue 타입 에러

| 수정 | 내용 |
|------|------|
| DataGrid flex 필수 규칙 | `flex: 1` 1개 이상 필수 + COLUMN_TYPES 컬럼에 flex 금지 예시 |
| DataGrid cellRenderer | Badge/Tag 사용 예시 추가 |
| Tag 섹션 | `variant` prop 금지 경고 (`tagType` 사용) |
| LabelValue 섹션 | Discriminated Union 필수 props 경고 (showPrefix/showStartIcon/showEndIcon) |
| 체크리스트 #14 | DataGrid flex 검증 |

---

## 4차: DataGrid.tsx 대규모 변경(+1196/-31) 반영 확인

**문제**: d537869 커밋에서 AG Grid Community → Enterprise 마이그레이션, 테마 시스템 등 대폭 변경

| 수정 | 내용 |
|------|------|
| Column Groups | "GRID DIES SILENTLY" 금지 → column group 정식 지원으로 변경 |
| 테마 섹션 | 기본 'aplus' 자동 적용 + 한국어 로캘 자동 적용 + 토큰 오버라이드 금지 |

---

## 5차: 3차 테스트 검증 결과 반영 (flex 잘못된 적용 + Icon size)

**문제**: AI가 `flex: 1`을 금액(currency) 컬럼에 적용 → 비정상 너비, Icon size 불일치

| 수정 | 내용 |
|------|------|
| flex 규칙 보강 | `❌ COLUMN_TYPES 컬럼에 flex 금지` 예시 추가 |
| Icon 가이드 보강 | size={20}에만 있는 14개 아이콘 경고 (image, info, error 등) |

---

## 6차: 4차 테스트 검증 결과 반영 (flex 우회 패턴 + Tag cellRenderer)

**문제**: AI가 `{ ...COLUMN_TYPES.currencyColumn, flex: 1 }` (spread 뒤에 flex)로 순서를 바꿔 우회. 비용유형 컬럼에 Tag 사용 시 DataGrid 셀 내 테두리/패딩 어색

| 수정 | 내용 |
|------|------|
| flex 금지 강화 | ❌ 예시 2개로 확장 — "순서 무관 절대 금지" 명시 (`{ ...spread, flex }`, `{ flex, ...spread }` 둘 다) |
| Tag cellRenderer 제거 | 분류/유형 컬럼은 cellRenderer 없이 일반 텍스트 권장 (Tag/Badge 불필요) |

**4차 테스트 검증 결과**:
- Badge `status` prop 정상 ✅
- Tag `variant` 미사용 ✅
- LabelValue Discriminated Union 완전 ✅
- Dialog.Footer wrapper 없음 ✅
- 비용유형 cellRenderer Badge → Tag 제거로 해결 ✅
- DataGrid flex: 1 → 여전히 COLUMN_TYPES 컬럼에 적용됨 (미해결 — AI 모델 수준 이슈)

---

## 미해결 이슈

### DataGrid flex: 1 잘못된 컬럼 적용

- 5~6차에 걸쳐 ❌ 예시를 강화했으나, AI가 여전히 COLUMN_TYPES 컬럼(금액 등)에 flex: 1 적용
- 현재 규칙에 순서 무관 금지 + 텍스트 컬럼만 flex 사용 안내가 모두 포함되어 있음
- 프롬프트 규칙 수준으로는 해결 한계 — AI 모델의 지시 준수력 문제로 판단
- 추후 코드 후처리(post-processing) 또는 lint 규칙으로 보완 검토 필요

---

## 현재 상태

- **브랜치**: `test/sync-verification`
- **staged 대기**: `apps/ai-service/app/api/components.py` (1~6차 수정)
- **총 변경량**: 약 +90 insertions, -30 deletions
- PRE_GENERATION_CHECKLIST: 기존 11개 → 14개 항목으로 확대
