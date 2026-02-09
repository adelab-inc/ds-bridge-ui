# React Error #137: HTML Void Element 이슈 분석 및 수정 가이드

> 작성일: 2026-02-09
> 대상: AI 코드 생성 프롬프트 관리 담당 개발자

---

## 1. 이슈 요약

### 에러 현상

DS-Runtime Hub 미리보기(Preview)에서 LLM이 생성한 React 코드가 **React Error #137**을 발생시킴.

```
Uncaught Error: input is a void element tag and must neither have `children`
nor use `dangerouslySetInnerHTML`.
```

### 원인

LLM이 코드 생성 시 다음 두 가지 패턴의 잘못된 코드를 출력:

1. **Native void element에 children 삽입** — `<input>텍스트</input>`, `<br>내용</br>` 등
2. **`<Field>` 안에 native `<input>` 중첩** — `<Field><input type="number" /></Field>` 패턴

`Field` 컴포넌트는 내부에 자체 `<input>` 또는 `<textarea>`를 렌더링하므로 children을 받지 않음. LLM이 `Field`를 wrapper로 오인하여 내부에 native `<input>`을 넣으면, 런타임 resolve 과정에서 void element에 children이 주입되어 크래시 발생.

### 영향 범위

- **미리보기 iframe 전체 크래시** — 에러 발생 시 해당 미리보기가 완전히 렌더링 불가
- **모든 AI 프로바이더 공통** — OpenAI(GPT-4.1), Anthropic(Claude), Gemini 모두 동일 이슈 가능
- **폼 UI 생성 시 빈번** — 숫자 입력, 날짜 입력, 검색 필드 등 폼 요소 포함 페이지에서 주로 발생

---

## 2. 코드 추적 결과

### 2-1. LLM 시스템 프롬프트 정의 파일

**파일**: `apps/ai-service/app/api/components.py`

| 항목 | 위치 |
|------|------|
| 시스템 프롬프트 헤더 | `SYSTEM_PROMPT_HEADER` (line ~441) |
| 시스템 프롬프트 푸터 | `SYSTEM_PROMPT_FOOTER` (line ~705) |
| 비전 모드 프롬프트 | `VISION_SYSTEM_PROMPT_HEADER` (line ~845) |
| 기존 void element 규칙 | line 591–601 |

```python
# components.py line 591-601 — 현재 존재하는 규칙
- **HTML Void Elements (SELF-CLOSING - CRITICAL)**:
  - These elements MUST be self-closing and CANNOT have children:
    - ✅ `<input />` or `<input style={{...}} />`
    - ✅ `<br />`, `<hr />`, `<img />`, `<meta />`, `<link />`
    - ❌ `<input>text</input>` (CAUSES REACT ERROR #137)
    - ❌ `<br>content</br>` (INVALID)
  - If you need a text label near an input, use a separate `<label>` element:
    ```tsx
    <label>이름</label>
    <input style={{width: '100%'}} />
    ```
```

**프롬프트 동적 생성 함수**: `apps/ai-service/app/api/chat.py`

| 함수 | 역할 |
|------|------|
| `resolve_system_prompt()` (line ~122) | 디자인 토큰 + 컴포넌트 스키마 + 레이아웃을 결합하여 최종 시스템 프롬프트 생성 |
| `build_instance_edit_context()` (line ~55) | 인스턴스 편집 모드 컨텍스트 추가 |

### 2-2. DS 컴포넌트 목록 / 스키마 정의

**화이트리스트 파일**: `apps/ai-service/app/api/components.py` (line 49–73)

```python
AVAILABLE_COMPONENTS_WHITELIST = {
    # Basic
    "Button", "IconButton", "Link",
    # Display
    "Alert", "Badge", "Chip", "Dialog", "Divider", "Tag", "Tooltip",
    # Form
    "Checkbox", "Field", "Radio", "Select", "ToggleSwitch",
    # Layout
    "Scrollbar", "Heading",
    # Data
    "DataGrid",
}
```

**로컬 스키마 폴백**: `apps/ai-service/component-schema.json`

- Firebase Storage에서 스키마를 가져오지 못할 때 사용
- 컴포넌트별 props, 타입, 기본값, 카테고리 정의

**스키마 → 프롬프트 포맷팅**: `components.py`의 `format_component_docs()` 함수 (line ~86)

- 스키마 JSON을 읽어 LLM이 이해할 수 있는 텍스트 형태로 변환
- 각 컴포넌트의 props, children 지원 여부, 사용 예시 포함

### 2-3. 미리보기 컴포넌트 resolve/매핑 로직

**파일**: `apps/web/components/features/preview/code-preview-iframe.tsx`

**동작 흐름**:

```
LLM 생성 코드 (JSX string)
  → import 구문에서 컴포넌트명 추출 (line 40-49, regex)
  → import 구문 제거 (line 51-77)
  → Sucrase로 JSX → JS 트랜스파일 (line 121-125)
  → window.AplusUI에서 컴포넌트 매핑 (line 273-285)
  → ReactDOM.createRoot로 렌더링 (line 296-298)
```

**핵심 매핑 코드** (line 273–285):

```typescript
const AplusUI = window.AplusUI || {};
const missingComponents = [];
// 각 import된 컴포넌트를 window.AplusUI에서 찾아 매핑
const ${comp} = AplusUI.${comp} || (function() {
  missingComponents.push('${comp}');
  return function(props) {
    return React.createElement('div', {
      style: { padding: '8px', border: '1px dashed #ccc', ... },
      ...props
    }, props.children || '[${comp}]');
  };
})();
```

**UMD 번들 제공**: `apps/web/app/api/ui-bundle/route.ts`

- `storybook-standalone/packages/ui/dist/ui.umd.js`를 `/api/ui-bundle`로 서빙
- `window.AplusUI`에 모든 DS 컴포넌트가 등록됨

### 2-4. Field 컴포넌트 구현부

**파일**: `storybook-standalone/packages/ui/src/components/Field.tsx`

**Props 인터페이스** (line 247–269):

```typescript
export interface FieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'size' | 'prefix'>,
    VariantProps<typeof fieldVariants> {
  label?: string;
  required?: boolean;
  helperText?: string;
  error?: boolean;
  prefix?: React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  onStartIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onEndIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  multiline?: boolean;
  rowsVariant?: 'flexible' | 'rows4' | 'rows6' | 'rows8';
  size?: 'md' | 'sm';
  inputProps?: React.HTMLAttributes<HTMLInputElement | HTMLTextAreaElement>;
  labelProps?: React.LabelHTMLAttributes<HTMLLabelElement>;
  helperTextProps?: React.HTMLAttributes<HTMLSpanElement>;
  startIconProps?: React.HTMLAttributes<HTMLElement>;
  endIconProps?: React.HTMLAttributes<HTMLElement>;
}
```

**렌더링 구조** (line 422–549):

```
<div>                           ← 컨테이너
  <label> {label} </label>      ← 라벨 (선택)
  <div>                         ← input wrapper
    <span>{prefix}</span>       ← 접두사 (선택)
    <div>                       ← input area
      {startIcon}               ← 시작 아이콘 (선택)
      <input /> 또는 <textarea />  ← ★ 내부에서 직접 렌더링
      {endIcon}                 ← 끝 아이콘 (선택)
    </div>
  </div>
  <span>{helperText}</span>     ← 도움말 (선택)
</div>
```

**핵심**: `Field`는 **children prop을 받지 않음**. 내부에서 `<input />`(line 497-512) 또는 `<textarea>`(line 479-495)를 직접 렌더링. `type`, `value`, `onChange` 등은 `Field`의 props로 직접 전달.

### 2-5. Native `<input>` 대신 사용할 DS Input 컴포넌트

**DS 컴포넌트: `Field`** — `storybook-standalone/packages/ui/src/components/Field.tsx`

| 용도 | 사용법 |
|------|--------|
| 텍스트 입력 | `<Field type="text" label="이름" />` |
| 숫자 입력 | `<Field type="number" label="수량" />` |
| 이메일 입력 | `<Field type="email" label="이메일" />` |
| 비밀번호 | `<Field type="password" label="비밀번호" />` |
| 여러 줄 텍스트 | `<Field multiline label="설명" />` |

`Field`는 화이트리스트(`AVAILABLE_COMPONENTS_WHITELIST`)에 포함되어 있으며, UMD 번들에도 정상 등록되어 `window.AplusUI.Field`로 접근 가능.

> **참고**: `apps/web/components/ui/input.tsx`의 `Input` 컴포넌트는 웹 앱 내부용(shadcn/ui 기반)이며, AI 코드 생성 화이트리스트에 포함되지 않음.

### 2-6. DatePicker 등 날짜 입력용 DS 컴포넌트

**존재하지 않음.**

- `@aplus/ui` 패키지에 `DatePicker`, `Calendar`, `DateInput` 등 날짜 전용 컴포넌트가 **없음**
- `package.json`에도 `react-datepicker` 등 날짜 관련 라이브러리 미설치

**현재 가능한 대안**:

| 방법 | 코드 예시 | 한계 |
|------|-----------|------|
| `Field`에 `type="date"` | `<Field type="date" label="날짜" />` | 브라우저 기본 date picker UI 사용, 스타일 커스터마이징 제한 |
| `Field`에 `type="datetime-local"` | `<Field type="datetime-local" label="일시" />` | 동일 |
| `Select` + 연/월/일 옵션 | `<Select options={yearOptions} />` | 구현 복잡, UX 제한 |

> 프롬프트에 이 사실을 명시하여 LLM이 존재하지 않는 `DatePicker` 컴포넌트를 import하지 않도록 해야 함.

---

## 3. 수정 가이드

### 3-1. 기존 규칙의 한계

현재 `components.py` line 591–601에 void element 규칙이 있지만 다음이 부족함:

1. **`Field` 컴포넌트에 children 금지** 규칙 없음 — LLM이 `<Field><input /></Field>` 패턴 생성 가능
2. **native `<input>` 대신 `Field` 사용** 지시 없음 — LLM이 native element를 직접 사용
3. **존재하지 않는 컴포넌트** 경고 없음 — `<DatePicker>`, `<NumberInput>` 등 임의 컴포넌트 생성

### 3-2. 수정 파일 및 삽입 위치

**파일**: `apps/ai-service/app/api/components.py`

**삽입 위치**: `SYSTEM_PROMPT_HEADER` 내부, 기존 void element 규칙(line 591–601) 바로 다음 (line 601 이후)

**수정 방법**: 기존 void element 규칙을 확장하여 아래 내용을 추가

### 3-3. 추가할 텍스트

기존 line 601 (`<input style={{width: '100%'}} />` 코드 블록 종료 후)에 아래 내용을 이어서 삽입:

```
- **CRITICAL: Use `<Field>` instead of native `<input>` (PREVENTS REACT ERROR #137)**:
  - The `Field` component renders its own `<input>` internally. NEVER nest elements inside it.
  - `Field` does NOT accept children. It is NOT a wrapper component.
  - Pass `type`, `value`, `onChange`, `placeholder` directly as `Field` props.
  - ✅ Correct usage:
    ```tsx
    <Field type="text" label="이름" placeholder="이름을 입력하세요" />
    <Field type="number" label="수량" value={count} onChange={handleChange} />
    <Field type="date" label="날짜" />
    <Field type="email" label="이메일" />
    <Field multiline label="설명" rowsVariant="flexible" />
    ```
  - ❌ WRONG (causes React Error #137):
    ```tsx
    <Field><input type="number" /></Field>
    <Field label="이름"><input value={name} /></Field>
    <Field>Some text</Field>
    ```
  - ❌ WRONG (native input without Field):
    ```tsx
    <input type="text" placeholder="이름" />
    <input type="number" value={count} />
    <textarea>내용</textarea>
    ```
- **Non-existent Components (DO NOT USE)**:
  - `DatePicker`, `DateInput`, `Calendar` — 존재하지 않음. `<Field type="date" />` 사용
  - `NumberInput`, `TextInput` — 존재하지 않음. `<Field type="number" />`, `<Field type="text" />` 사용
  - `TextArea`, `Textarea` — 존재하지 않음. `<Field multiline />` 사용
```

---

## 4. 프롬프트 추가 규칙 예시

아래는 프로젝트의 실제 DS 컴포넌트명을 기반으로 작성한, `SYSTEM_PROMPT_HEADER`에 삽입 가능한 전체 규칙 블록:

```python
# components.py SYSTEM_PROMPT_HEADER 내 삽입용 (line 601 이후)

"""
- **CRITICAL: Use `<Field>` instead of native `<input>` (PREVENTS REACT ERROR #137)**:
  - The `Field` component renders its own `<input>` internally. NEVER nest elements inside it.
  - `Field` does NOT accept children. It is NOT a wrapper component.
  - Pass `type`, `value`, `onChange`, `placeholder` directly as `Field` props.
  - ✅ Correct usage:
    ```tsx
    <Field type="text" label="이름" placeholder="이름을 입력하세요" />
    <Field type="number" label="수량" value={count} onChange={handleChange} />
    <Field type="date" label="날짜" />
    <Field type="email" label="이메일" />
    <Field type="password" label="비밀번호" />
    <Field multiline label="설명" rowsVariant="flexible" />
    <Field label="검색" startIcon="🔍" placeholder="검색어를 입력하세요" />
    ```
  - ❌ WRONG — Children inside Field (causes React Error #137):
    ```tsx
    <Field><input type="number" /></Field>
    <Field label="이름"><input value={name} /></Field>
    <Field>텍스트</Field>
    ```
  - ❌ WRONG — Native input without Field wrapper:
    ```tsx
    <input type="text" placeholder="이름" />
    <input type="number" value={count} />
    <textarea rows={4}>내용</textarea>
    ```
  - For form layouts, combine `Field` with `div` containers:
    ```tsx
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
      <Field type="text" label="이름" placeholder="이름" />
      <Field type="email" label="이메일" placeholder="이메일" />
      <Field type="number" label="나이" />
      <Field type="date" label="생년월일" />
    </div>
    ```
- **Non-existent Components — DO NOT import or use**:
  - `DatePicker`, `DateInput`, `Calendar` → Use `<Field type="date" />`
  - `TimePicker`, `TimeInput` → Use `<Field type="time" />`
  - `NumberInput`, `TextInput` → Use `<Field type="number" />`, `<Field type="text" />`
  - `TextArea`, `Textarea` → Use `<Field multiline />`
  - `Input` → Use `<Field />` (Input is NOT in the whitelist)
- **Other void elements reminder**:
  - `<img />`, `<br />`, `<hr />` must ALWAYS be self-closing
  - NEVER: `<img>content</img>`, `<br>text</br>`, `<hr>line</hr>`
"""
```

---

## 5. 검증 방법

### 5-1. 프롬프트 수정 후 확인 절차

1. **수정 파일 확인**
   ```bash
   # components.py에서 추가된 규칙 확인
   grep -n "Use.*Field.*instead.*native" apps/ai-service/app/api/components.py
   grep -n "Non-existent Components" apps/ai-service/app/api/components.py
   ```

2. **AI 서비스 재시작**
   ```bash
   cd apps/ai-service
   uv run uvicorn app.main:app --reload --port 8000
   ```

3. **시스템 프롬프트 출력 확인**
   - `GET /components` 엔드포인트 호출하여 생성된 시스템 프롬프트에 새 규칙이 포함되는지 확인
   - 또는 `resolve_system_prompt()` 반환값을 로그로 출력

### 5-2. 테스트 프롬프트 (에러 재현 → 수정 확인)

아래 프롬프트들로 LLM이 올바른 코드를 생성하는지 검증:

| # | 테스트 프롬프트 | 기대 결과 |
|---|----------------|-----------|
| 1 | "숫자 입력 필드가 있는 주문 수량 폼 만들어줘" | `<Field type="number" />` 사용, native `<input>` 미사용 |
| 2 | "이름, 이메일, 생년월일 입력 폼 만들어줘" | `<Field type="date" />` 사용, `DatePicker` 미사용 |
| 3 | "검색 바와 필터가 있는 테이블 페이지" | `<Field>` 사용, `<input>` 미사용 |
| 4 | "회원가입 폼: 이름, 비밀번호, 비밀번호 확인, 전화번호" | 모든 입력이 `<Field>` 컴포넌트 |
| 5 | "여러 줄 텍스트 입력이 있는 피드백 폼" | `<Field multiline />` 사용, `<textarea>` 미사용 |

### 5-3. 미리보기 렌더링 확인

1. 위 테스트 프롬프트로 코드 생성
2. DS-Runtime Hub 미리보기(Preview) 탭에서 렌더링 확인
3. 브라우저 콘솔에서 `React Error #137` 미발생 확인
4. `[Preview] Missing components from @aplus/ui` 경고 미발생 확인

### 5-4. 비전 모드 프롬프트 확인

`VISION_SYSTEM_PROMPT_HEADER` (line ~845)에도 동일한 규칙이 필요한지 검토:
- 비전 모드는 이미지 → 코드 변환이므로, 폼 UI가 포함된 디자인 이미지를 변환할 때 동일 이슈 발생 가능
- 필요 시 비전 프롬프트에도 동일 규칙 추가 권장

---

## 부록: 관련 파일 경로 요약

| 구분 | 파일 경로 |
|------|-----------|
| 시스템 프롬프트 (수정 대상) | `apps/ai-service/app/api/components.py` |
| 프롬프트 조합 로직 | `apps/ai-service/app/api/chat.py` |
| 컴포넌트 스키마 (로컬) | `apps/ai-service/component-schema.json` |
| 요청/응답 스키마 | `apps/ai-service/app/schemas/chat.py` |
| AI 프로바이더 | `apps/ai-service/app/services/ai_provider.py` |
| 미리보기 컴포넌트 매핑 | `apps/web/components/features/preview/code-preview-iframe.tsx` |
| UMD 번들 서빙 | `apps/web/app/api/ui-bundle/route.ts` |
| Field 컴포넌트 구현 | `storybook-standalone/packages/ui/src/components/Field.tsx` |
| DS 컴포넌트 배럴 export | `storybook-standalone/packages/ui/src/components/index.ts` |
