# PRD: LLM 코드 생성에서 DS 컴포넌트 로컬 재정의 방지

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-04-25 |
| 담당 코드 | `apps/ai-service/app/api/components.py` |
| 영향 범위 | AI 코드 생성 system prompt (모든 프로바이더: OpenAI / Anthropic / Gemini) |
| 우선순위 | P1 — 사용자 화면에서 SyntaxError로 프리뷰 미렌더 사고가 다른 식별자(`Icon`, `Alert`)로 반복 발생 중 |

---

## 1. 문제 정의 (Problem)

LLM이 생성한 React 코드가 `apps/web/.../code-preview-iframe.tsx` 의 iframe 내부에서 다음 형태의 콘솔 에러로 **렌더 실패**:

```
Uncaught SyntaxError: Identifier 'Icon' has already been declared
Uncaught SyntaxError: Identifier 'Alert' has already been declared
```

### 1-1. 재현된 LLM 출력 패턴

LLM이 DS(`@aplus/ui` / `@/components`)에 이미 존재하는 컴포넌트를 **import 하지 않거나, import 해놓고 동시에 파일 하단에서 로컬 헬퍼로 다시 정의**:

```tsx
// 케이스 A: import 누락 + 로컬 정의
import { Button, Field } from '@/components'; // Icon 빠짐
// ...본문에서 <Icon name="download" /> 사용
const Icon = ({ name, size = 20, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`} style={{ fontSize: size }}>
    {name}
  </span>
);
const IconButton = ({ iconOnly, onClick, ariaLabel }) => ( ... );

// 케이스 B: import + 로컬 정의 동시
import { Alert, Button } from '@/components';
// ...
const Alert = ({ children }) => <div className="bg-red-50">{children}</div>;
```

### 1-2. 연쇄 임팩트

1. **즉시 사고**: iframe 측 자동 주입 로직과 사용자 코드의 로컬 선언이 같은 IIFE 스코프에서 충돌 → `Identifier already declared` SyntaxError → 프리뷰 빈 화면.
2. **잠재 사고**: iframe 측 패치(다른 세션 + 이번 세션, 2026-04-25 적용)로 SyntaxError는 막혔지만:
   - LLM이 만든 `Icon`은 `material-symbols-outlined` Google Font 클래스에 의존 → iframe HTML에 폰트 link가 없어 **아이콘 자리에 텍스트만 표시** ("download", "search", "close").
   - DS의 정식 `Icon`(Hugeicons UMD)을 우회 → 톤/사이즈/색이 다른 컴포넌트와 어긋남.
3. **재발성**: `Icon`, `IconButton`, `Alert` 모두 DS 화이트리스트(`AVAILABLE_COMPONENTS_WHITELIST`, components.py:51–101)에 들어있는데도 LLM이 반복적으로 재정의하고 있음. 즉 **단발성 사고가 아니라 시스템 프롬프트 미흡으로 인한 systematic 회귀**.

### 1-3. 현 시스템 프롬프트의 한계

`SYSTEM_PROMPT_HEADER`(components.py:1232~)의 *Implementation Rules* 1287번째 줄에 **딱 한 줄**:

```
2. import 양방향 점검: import→JSX, JSX→import 모두 1:1 매칭. 커스텀 컴포넌트 정의 금지(import 사용)
```

`FINAL_REMINDER`(1616~)에는 *import 양방향* 검증(1622, 1623)만 존재하고 **로컬 재정의 검증 항목은 없음**. 4단어짜리 "커스텀 컴포넌트 정의 금지" 한 줄로는 LLM이 무시하기 충분히 약하다는 게 두 사고의 결론.

---

## 2. 목표 (Goal)

LLM이 생성하는 코드에서 **DS 화이트리스트에 등재된 컴포넌트 이름**(`AVAILABLE_COMPONENTS_WHITELIST`, components.py:51)을 **로컬 헬퍼/래퍼로 재정의하지 않도록** system prompt를 강화하여 SyntaxError 재발과 비주얼 품질 저하를 동시에 차단.

### Non-Goal

- iframe 측 방어 로직(`code-preview-iframe.tsx`의 `locallyDeclared` 필터)은 이미 적용 완료. 본 PRD는 **그쪽을 손대지 않음**.
- Figma 추출/시뮬레이션 파이프라인 변경 없음.
- LLM 모델 자체 교체 없음.

---

## 3. Acceptance Criteria

| # | 기준 | 검증 방법 |
|---|---|---|
| AC-1 | DS 화이트리스트 컴포넌트 이름(`Icon`, `IconButton`, `Alert`, `Badge` 등 100여 개)을 사용자 코드가 `const`/`let`/`var`/`function`/`class`로 재정의하지 않음 | 아래 §6 회귀 프롬프트 10건 중 0건 재정의 |
| AC-2 | DS에 존재하지 않는 진짜 커스텀 컴포넌트(예: `KpiCard` 같은 합성 컴포넌트)는 여전히 정의 가능 | 합성 컴포넌트 요구 프롬프트로 회귀 (§6) |
| AC-3 | iframe 프리뷰에서 위 두 사고 케이스 재현 시 콘솔에 `Identifier ... already been declared` 0건 | 사용자/QA가 브라우저에서 확인 |
| AC-4 | 아이콘이 `material-symbols-outlined` 텍스트가 아니라 Hugeicons로 정상 렌더 | 시각 확인 |

---

## 4. 구현 계획 (담당자 작업 가이드)

> 모든 변경은 `apps/ai-service/app/api/components.py` **한 파일**에 집중. 파이썬 모듈 구조나 다른 라우터를 건드릴 필요 없음.

### 4-1. (P1) `SYSTEM_PROMPT_HEADER` Implementation Rules 강화

**위치**: components.py:1285–1297 의 `## Implementation Rules` 섹션. 기존 2번 항목을 분리·강화.

**변경 전 (1287)**:
```
2. import 양방향 점검: import→JSX, JSX→import 모두 1:1 매칭. 커스텀 컴포넌트 정의 금지(import 사용)
```

**변경 후 (예시)**:
```
2. import 양방향 점검: import→JSX, JSX→import 모두 1:1 매칭

2-1. 🚨 **DS 컴포넌트 로컬 재정의 절대 금지** = CRASH
   - Available Components 목록의 이름(Icon, IconButton, Alert, Badge, Button, Field, ...)은
     **import만** 하고 사용. 동일 이름으로 const/let/var/function/class 절대 정의 금지.
   - ❌ const Icon = ({ name }) => <span ...>{name}</span>;       // CRASH (Identifier already declared)
   - ❌ const Alert = ({ children }) => <div>{children}</div>;    // CRASH
   - ❌ const IconButton = ({ iconOnly }) => <button>{iconOnly}</button>;  // CRASH
   - ✅ import { Icon, Alert, IconButton } from '@/components';
   - 사유: iframe 프리뷰 빌더가 DS 컴포넌트를 자동 주입하므로, 같은 이름의 로컬 선언은
     V8의 "Identifier already declared" SyntaxError를 일으켜 프리뷰가 통째로 깨집니다.

2-2. **합성 컴포넌트는 DS와 다른 이름으로**
   - DS에 없는 합성 컴포넌트(예: KPI 카드, 요약 박스)는 정의해도 됨. 단,
     이름이 Available Components와 겹치지 않도록 한다.
   - ✅ const KpiCard = (...) => ...;           // DS에 없는 이름 → OK
   - ❌ const Badge = (...) => ...;             // DS Badge와 충돌 → CRASH
```

> 텍스트는 위 의미를 담은 채로 길이를 줄여도 되나, **❌/✅ 대비 + "= CRASH" + "Identifier already declared" 키워드**는 유지할 것. 키워드가 들어있을 때 LLM이 가장 잘 지킨다는 게 컴파일/Field/이미지 URL 룰의 학습 결과(현 prompt의 다른 룰들이 이 양식을 따르는 이유).

### 4-2. (P1) `FINAL_REMINDER` 검증 항목 추가

**위치**: components.py:1622–1623 의 *CRASH 방지 (필수)* 블록 끝에 항목 추가.

**추가 텍스트**:
```
2-1. 🚨 **DS 컴포넌트 로컬 재정의 점검**: Available Components 목록(Icon, IconButton, Alert, Badge,
     Button, Field, ...)에 있는 이름을 `const X = ...` / `function X(...) { ... }` 등으로
     로컬 정의하지 않았는가? → 재정의했으면 정의문 삭제하고 import 문에만 추가.
     (재정의 = `Identifier already declared` SyntaxError = 프리뷰 빈 화면)
```

번호는 기존 `1.`, `2.` 사이에 끼우거나 끝에 신규 번호로 붙여도 무방. 다만 *CRASH 방지* 그룹 안에 위치시켜 우선순위가 보이게.

### 4-3. (P2, 선택) Available Components 노트에 명시적 안내 한 줄

**위치**: `get_available_components_note()` (components.py:357) 가 만드는 문자열.

**현재**:
```python
return f"**Available Components ({len(names)}):** {', '.join(names)}\n\n"
```

**제안**:
```python
return (
    f"**Available Components ({len(names)}):** {', '.join(names)}\n\n"
    f"⚠️ 위 이름들은 import 해서 사용. **로컬 const/function 으로 재정의하면 SyntaxError**.\n\n"
)
```

`SYSTEM_PROMPT` 구성 순서(1740–1751)상 *Available Components* 블록은 `COMPONENT_DOCS` 직전에 들어가므로, 컴포넌트 이름 나열 바로 옆에 경고가 붙어 가장 효과적인 위치. (4-1, 4-2와 중복돼 보이지만 LLM은 *반복 강조*를 가장 잘 따름 — Icon size 룰이 같은 패턴.)

### 4-4. (P3, 선택) 후처리 lint 가드 (서버 사이드)

> 본 PRD의 핵심은 4-1/4-2/4-3. 4-4는 프롬프트 강화 후에도 회귀가 남을 때만 단계적으로.

`generate_system_prompt()` 와는 별도로, AI 응답 본문에서 코드 블록을 추출하는 시점(채팅 라우터, `apps/ai-service/app/api/chat.py`로 추정)에 정규식 가드:

```python
# components.py 또는 chat.py 어딘가
def detect_dscomponent_redefinition(code: str) -> list[str]:
    """DS 컴포넌트 이름을 로컬 선언한 식별자 반환 (없으면 빈 리스트)."""
    pattern = re.compile(
        r"(?:^|[\s;])(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_]*)\b"
    )
    declared = {m.group(1) for m in pattern.finditer(code)}
    return sorted(declared & AVAILABLE_COMPONENTS_WHITELIST)
```

용례:
- 검출 시 응답에 경고 메타데이터 첨부 (관측용)
- 또는 retry 1회로 LLM에게 "X 를 로컬 정의했다. import 로 바꿔라" 재요청

운영 비용이 있으므로 **AC-1 결과로 4-1~4-3 만으로 충분치 않을 때**만 진입. 우선은 프롬프트 변경만으로 효과를 측정.

---

## 5. 참고 코드 위치

| 항목 | 파일:라인 |
|---|---|
| 화이트리스트 정의 | `apps/ai-service/app/api/components.py:51` (`AVAILABLE_COMPONENTS_WHITELIST`) |
| Implementation Rules (수정 1) | `components.py:1285–1297` |
| FINAL_REMINDER (수정 2) | `components.py:1616–1657` |
| Available Components 노트 (수정 3) | `components.py:357–361` (`get_available_components_note`) |
| SYSTEM_PROMPT 조립 | `components.py:1740–1751` |
| iframe 측 방어 (참고만, 수정 X) | `apps/web/components/features/preview/code-preview-iframe.tsx:282–302` (`locallyDeclared` 필터) |

---

## 6. 검증 (Test Plan)

### 6-1. Prompt-level 회귀 (오프라인)

`get_system_prompt()` 결과를 받아 다음 10개 프롬프트로 LLM에 호출하고, 응답 코드에서 `AVAILABLE_COMPONENTS_WHITELIST` 이름이 `const|let|var|function|class`로 재정의됐는지 정규식 검사. **0건이어야 통과 (AC-1)**.

| # | 사용자 프롬프트 | 회귀 의도 |
|---|---|---|
| 1 | "통신비 공제 상세 화면 만들어줘 (Icon, IconButton 사용)" | Icon/IconButton 재정의 회귀 (이번 사고) |
| 2 | "에러 알림 박스가 있는 폼" | Alert 재정의 회귀 (다른 세션 사고) |
| 3 | "상태 Badge가 들어간 게시판 목록" | Badge 재정의 |
| 4 | "DataGrid + 필터바 화면" | DataGrid/FilterBar 재정의 |
| 5 | "TitleSection 안에 다운로드/인쇄 버튼" | Button + Icon 조합 |
| 6 | "Drawer로 상세 편집" | Drawer 재정의 |
| 7 | "Tab으로 보기 전환" | Tab 재정의 |
| 8 | "체크박스/라디오 폼" | Checkbox/Radio/Option 재정의 |
| 9 | "KPI 요약 카드 4개 + 그리드" | KpiCard 같은 *합성* 컴포넌트는 정의 허용되는지 (AC-2 확인) |
| 10 | "툴팁이 달린 도움말 아이콘" | Tooltip + Icon |

자동화는 1회 수행으로 충분(LLM은 비결정적이라 N=3~5 반복 권장). 통과 기준: AC-1 만족 + AC-2 의 9번 케이스에서 `KpiCard` 같은 화이트리스트 외 이름의 정의는 그대로 살아있는지.

### 6-2. End-to-End 브라우저 확인

1. `apps/ai-service`에서 `uv run uvicorn app.main:app --reload --port 8000`.
2. `apps/web`에서 `pnpm dev` (port 5555).
3. 위 #1, #2 프롬프트로 채팅 세션을 실제 진행.
4. 프리뷰 iframe 콘솔에 `Identifier ... already been declared` 0건 (AC-3).
5. 아이콘이 텍스트가 아니라 Hugeicons로 보임 (AC-4).

### 6-3. 회귀 방지

`docs/ai-service/PRD-LLM_헬퍼_재정의_방지.md` 본 문서에 §6-1 프롬프트 목록을 보존하여, 향후 prompt 리팩토링 시 같은 검증을 다시 돌릴 수 있도록 함.

---

## 7. 리스크 / 주의

- **프롬프트 길이 증가**: 4-1, 4-2, 4-3을 모두 적용해도 토큰 증가는 ~150 tokens 미만. 현재 `SYSTEM_PROMPT` 규모 대비 무시 가능. context window 영향 없음.
- **Over-restriction 위험 (AC-2)**: "재정의 금지"가 화이트리스트에 없는 합성 컴포넌트(KpiCard 등)까지 막아 버리지 않도록, 4-1 의 2-2 항목과 §6-1 의 #9 회귀 케이스로 명시. 수정 시 이 구분이 흐려지지 않도록 **반드시 "Available Components 목록의 이름"이라는 한정자**를 유지할 것.
- **다국어 LLM**: 현 prompt는 한글 + 영문 혼용. 추가 텍스트도 동일 톤 유지. 번역 일원화 시도 금지(다른 룰들과 결도 안 맞고, 비교 실험 시 변수가 늘어남).
- **모델 별 효과 차이**: Anthropic Claude / OpenAI GPT-4.1 / Gemini 2.5 가 동일 prompt에 다르게 반응할 수 있음. §6-1을 세 프로바이더 모두 회귀.

---

## 8. Out of Scope

- iframe 측(`code-preview-iframe.tsx`) 추가 보강 — 이미 `locallyDeclared` 필터로 양 경로(auto-detect + explicit import) 차단 완료.
- AI가 만든 `material-symbols-outlined` 의존 코드도 *프리뷰 안에서 어떻게든 보이게* 하기 위해 폰트 link 추가 — 본 PRD의 목적과 반대(LLM이 그 코드를 만들지 않게 하는 게 목적).
- DS 화이트리스트 자체의 재구성(어떤 컴포넌트를 추가/제거할지) — 별도 결정 필요.

---

## 9. 한 줄 요약

화이트리스트(`AVAILABLE_COMPONENTS_WHITELIST`)에 있는 100여 개 DS 컴포넌트 이름을 **로컬 재정의하지 말고 import 만 해라**는 룰을, 시스템 프롬프트 3곳(`Implementation Rules` / `FINAL_REMINDER` / `Available Components` 노트)에 동일 톤으로 강하게 명시한다.
