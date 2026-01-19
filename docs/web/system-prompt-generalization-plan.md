# AI 코드 생성 시스템 프롬프트 범용화

## 요청 사항

- 현재 시스템 프롬프트가 특정 디자인 시스템(`@aplus/ui`)에 하드코딩됨
- 다양한 디자인 시스템을 커버할 수 있도록 범용화 필요
- **핵심 원칙**: JSON 스키마에 명시된 속성들만 활용하여 React 코드 생성

## 현재 문제점

### 1. 하드코딩된 규칙 (components.py:206-385)

```python
SYSTEM_PROMPT_FOOTER = """
### 3. Common Mistakes to AVOID
❌ color="green"        → ✅ variant="success-solid"    # @aplus/ui 특화
❌ <UserBadge>          → ✅ Use <div> ...              # @aplus/ui 특화

### 7. Design System Guidelines
#### Spacing System (8px base)                          # @aplus/ui 특화
#### Color Usage
- Use semantic colors from components (variant props)   # @aplus/ui 특화
"""
```

### 2. 스키마에 사용 규칙 부재

현재 `component-schema.json`:
```json
{
  "Badge": {
    "props": {
      "statusVariant": { "type": ["error", "info", ...] },
      "variant": { "type": ["success-solid", ...] }
    }
  }
}
```

**누락된 정보**:
- `type="status"` 사용 시 `statusVariant` 필수라는 규칙
- Chip은 `value` 대신 `children` 사용해야 한다는 규칙
- props 간 의존관계

### 3. 범용성 부족

다른 디자인 시스템(MUI, Chakra UI, Ant Design 등)에 적용 불가

## 해결 방안

### 접근법: 스키마 확장 + 프롬프트 동적 생성

1. **component-schema.json 확장**: 컴포넌트별 사용 규칙 추가
2. **시스템 프롬프트 동적화**: 스키마에서 규칙을 읽어 프롬프트 생성

### 스키마 확장 구조

```json
{
  "version": "1.1.0",
  "metadata": {
    "name": "@aplus/ui",
    "description": "Aplus Design System",
    "importPath": "@/components"
  },
  "globalRules": {
    "spacing": { "base": 8, "scale": [4, 8, 16, 24, 32, 48, 64] },
    "colors": {
      "note": "Use semantic colors via variant props",
      "neutrals": ["#f5f5f5", "#e5e5e5", "#333", "#666"]
    },
    "borderRadius": { "sm": 4, "md": 8, "lg": 12, "pill": 9999 }
  },
  "components": {
    "Badge": {
      "props": { ... },
      "usageRules": [
        {
          "condition": "type=\"status\"",
          "requires": ["statusVariant"],
          "note": "status 타입 사용 시 statusVariant 필수"
        }
      ],
      "examples": {
        "correct": "<Badge variant=\"success-solid\" type=\"status\" statusVariant=\"success\">추천</Badge>",
        "incorrect": "<Badge variant=\"success-solid\" type=\"status\">추천</Badge>"
      }
    },
    "Chip": {
      "props": { ... },
      "usageRules": [
        {
          "note": "텍스트는 children으로 전달, value prop 사용 금지"
        }
      ],
      "examples": {
        "correct": "<Chip size=\"sm\">화면 분할 도구</Chip>",
        "incorrect": "<Chip value=\"화면 분할 도구\" size=\"sm\" />"
      }
    }
  }
}
```

### 프롬프트 동적 생성 로직 수정

```python
def generate_system_prompt(schema: dict) -> str:
    # 1. 메타데이터에서 디자인 시스템 정보 추출
    metadata = schema.get("metadata", {})
    import_path = metadata.get("importPath", "@/components")

    # 2. 글로벌 규칙 포맷팅 (있는 경우에만)
    global_rules = format_global_rules(schema.get("globalRules", {}))

    # 3. 컴포넌트 문서 생성 (usageRules 포함)
    component_docs = format_component_docs_with_rules(schema)

    # 4. 범용 프롬프트 조합
    return (
        GENERIC_HEADER  # 디자인 시스템 독립적
        + f"Import path: `{import_path}`\n"
        + component_docs
        + global_rules
        + RESPONSE_FORMAT  # 동일
        + GENERIC_FOOTER   # 디자인 시스템 독립적 React 규칙만
    )
```

## 구현 계획

### Phase 1: 스키마 확장 (오버라이드 파일 방식)

스키마는 `react-docgen-typescript`로 자동 생성되므로, **오버라이드 파일**을 통해 커스텀 필드 추가

#### 1.1 오버라이드 JSON 파일 생성

**파일**: `storybook-standalone/scripts/component-schema-overrides.json`

```json
{
  "metadata": {
    "name": "@aplus/ui",
    "description": "Aplus Design System",
    "importPath": "@/components"
  },
  "globalRules": {
    "spacing": { "base": 8, "scale": [4, 8, 16, 24, 32, 48, 64] },
    "colors": {
      "note": "Use semantic colors via variant props, avoid pure black (#000)",
      "neutrals": ["#f5f5f5", "#e5e5e5", "#333", "#666", "#1a1a1a"]
    },
    "borderRadius": { "sm": 4, "md": 8, "lg": 12, "pill": 9999 }
  },
  "componentOverrides": {
    "Badge": {
      "usageRules": [
        {
          "condition": "type=\"status\"",
          "requires": ["statusVariant"],
          "note": "status 타입 사용 시 statusVariant 필수"
        }
      ],
      "examples": {
        "correct": "<Badge variant=\"success-solid\" type=\"status\" statusVariant=\"success\">추천</Badge>",
        "incorrect": "<Badge variant=\"success-solid\" type=\"status\">추천</Badge>"
      }
    },
    "Chip": {
      "usageRules": [
        { "note": "텍스트는 children으로 전달, value prop 사용 금지" }
      ],
      "examples": {
        "correct": "<Chip size=\"sm\">화면 분할 도구</Chip>",
        "incorrect": "<Chip value=\"화면 분할 도구\" size=\"sm\" />"
      }
    },
    "Heading": {
      "usageRules": [
        { "note": "div 기반 컴포넌트 (h1, h2 아님), 커스텀 스타일은 style prop 사용" }
      ]
    }
  }
}
```

#### 1.2 스키마 생성 스크립트 수정

**파일**: `storybook-standalone/scripts/extract-component-schema.ts`

- 오버라이드 파일 로드
- `metadata`, `globalRules`를 최종 스키마에 병합
- 각 컴포넌트에 `usageRules`, `examples` 필드 병합

```typescript
// 수정 내용:
// 1. 오버라이드 파일 로드
const OVERRIDES_PATH = path.join(__dirname, 'component-schema-overrides.json');
const overrides = fs.existsSync(OVERRIDES_PATH)
  ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8'))
  : {};

// 2. 최종 스키마에 metadata, globalRules 추가
const combinedSchema: CombinedSchema = {
  version: '1.1.0',
  generatedAt: new Date().toISOString(),
  metadata: overrides.metadata || {},
  globalRules: overrides.globalRules || {},
  components: {},
};

// 3. 각 컴포넌트에 오버라이드 병합
const componentOverride = overrides.componentOverrides?.[displayName] || {};
combinedSchema.components[displayName] = {
  ...baseSchema,
  usageRules: componentOverride.usageRules || [],
  examples: componentOverride.examples || {},
};
```

### Phase 2: 프롬프트 동적화

#### 2.1 `components.py` 리팩토링

**기존 하드코딩 제거:**
- `SYSTEM_PROMPT_FOOTER`에서 디자인 시스템 특화 규칙 제거
  - `color="green" → variant="success-solid"` 예시 제거
  - `8px spacing system` 제거
  - 금지 컴포넌트 목록 (`UserBadge`, `ChatMessage`) 제거

**동적 생성 함수 추가:**

```python
def format_usage_rules(component: dict) -> str:
    """컴포넌트의 usageRules를 포맷팅"""
    rules = component.get("usageRules", [])
    if not rules:
        return ""

    lines = ["⚠️ Usage Rules:"]
    for rule in rules:
        if rule.get("condition"):
            lines.append(f"  - When {rule['condition']}: {rule.get('requires', [])} required")
        if rule.get("note"):
            lines.append(f"  - {rule['note']}")
    return "\n".join(lines)

def format_examples(component: dict) -> str:
    """컴포넌트의 examples를 포맷팅"""
    examples = component.get("examples", {})
    if not examples:
        return ""

    lines = []
    if examples.get("correct"):
        lines.append(f"✅ Correct: {examples['correct']}")
    if examples.get("incorrect"):
        lines.append(f"❌ Incorrect: {examples['incorrect']}")
    return "\n".join(lines)

def format_global_rules(global_rules: dict) -> str:
    """globalRules를 시스템 프롬프트 섹션으로 포맷팅"""
    if not global_rules:
        return ""

    lines = ["\n## Design System Guidelines\n"]

    if "spacing" in global_rules:
        spacing = global_rules["spacing"]
        lines.append(f"### Spacing System ({spacing.get('base', 8)}px base)")
        lines.append(f"Scale: {', '.join(map(str, spacing.get('scale', [])))}")

    if "colors" in global_rules:
        colors = global_rules["colors"]
        if colors.get("note"):
            lines.append(f"\n### Colors\n{colors['note']}")

    if "borderRadius" in global_rules:
        br = global_rules["borderRadius"]
        lines.append(f"\n### Border Radius\n{br}")

    return "\n".join(lines)
```

#### 2.2 새로운 프롬프트 구조

```python
GENERIC_HEADER = """You are a premium UI/UX designer AI specializing in modern web interfaces.
Create high-quality designs using ONLY the components documented in the schema below.
Always respond in Korean with brief design explanations.

CRITICAL RULES:
- Use ONLY components and props defined in the schema
- Do NOT create custom components - use <div> with inline styles for custom UI
- Import ALL components you use
- Follow the usage rules specified for each component
"""

GENERIC_FOOTER = """
## React Best Practices

### Component Structure
- One main component per file
- Keep component logic focused and single-purpose

### State Management
- Clear state naming: isModalOpen, selectedItems, formData
- Import useState when using state

### Event Handlers
- Use handle + Action pattern: handleSubmit, handleItemClick

### List Rendering
- Always use unique, stable keys (not array index)

### Accessibility
- Add aria-label for icon-only buttons
- Use semantic HTML elements

## Before Submitting Checklist
- [ ] Code wrapped in <file path="...">...</file> tags
- [ ] All components imported from schema's import path
- [ ] All props exist in schema and values match types
- [ ] Lists have unique keys
- [ ] Interactive elements have aria labels
"""
```

### Phase 3: 문서 정리

- `docs/web/aplus-ui-props-guide.md` **삭제** (스키마에 규칙 포함됨)
- `apps/web/CLAUDE.md`에서 해당 참조 제거

## 수정 파일

| 파일 | 작업 |
|------|------|
| `storybook-standalone/scripts/component-schema-overrides.json` | **신규** - 오버라이드 정의 |
| `storybook-standalone/scripts/extract-component-schema.ts` | 오버라이드 병합 로직 추가 |
| `apps/ai-service/app/api/components.py` | 동적 프롬프트 생성으로 리팩토링 |
| `docs/web/aplus-ui-props-guide.md` | 삭제 |
| `apps/web/CLAUDE.md` | 가이드 참조 제거 |

## 검증 방법

1. **스키마 재생성**
   ```bash
   cd storybook-standalone
   pnpm schema:extract
   ```
   - `dist/component-schema.json`에 `metadata`, `globalRules`, `usageRules` 포함 확인

2. **프롬프트 확인**
   ```bash
   cd apps/ai-service
   uv run uvicorn app.main:app --reload
   # GET /components 또는 로그에서 시스템 프롬프트 확인
   ```

3. **E2E 테스트**
   - POST `/chat/stream`으로 Badge 포함 UI 요청
   - 응답에 `statusVariant` 포함 여부 확인
