# AI 컴포넌트 사용 가이드

AI가 `@aplus/ui` 컴포넌트를 사용할 때 참고해야 할 Props 호환성 가이드입니다.

---

## Chip 컴포넌트

**문제**: AI가 `value` prop에 텍스트를 전달하지만, 원래 Chip은 `children`으로 텍스트를 받음

**잘못된 사용:**
```jsx
<Chip value="화면 분할 도구" size="sm" state="selected" selectionStyle="single" />
```

**올바른 사용:**
```jsx
<Chip size="sm" state="selected" selectionStyle="single">화면 분할 도구</Chip>
```

---

## Badge 컴포넌트

**문제**: AI가 `statusVariant` prop을 누락하여 배경색/텍스트색이 적용되지 않음

Badge는 compoundVariants 구조로 `type` + `variant` + `statusVariant` 3개가 모두 매칭되어야 스타일이 적용됩니다.

**잘못된 사용 (스타일 미적용):**
```jsx
<Badge variant="success-solid" type="status">추천</Badge>
```

**올바른 사용:**
```jsx
<Badge variant="success-solid" type="status" statusVariant="success">추천</Badge>
```

**variant별 필요한 statusVariant:**

| variant | statusVariant |
|---------|---------------|
| `success-solid`, `success-subtle` | `statusVariant="success"` |
| `error-solid`, `error-subtle` | `statusVariant="error"` |
| `warning-solid`, `warning-subtle` | `statusVariant="warning"` |
| `info-solid`, `info-subtle` | `statusVariant="info"` |

> **규칙**: `type="status"` 사용 시 반드시 `statusVariant`도 함께 지정

---

## Heading 컴포넌트

**주의**: Heading은 `Menu/Heading.tsx`에서 re-export된 컴포넌트입니다.

**사용 예시:**
```jsx
<Heading style={{ fontSize: 28 }}>티라미수</Heading>
```

**컴포넌트 특성:**
- `div` 기반 (h1, h2 태그 아님)
- 기본 스타일: `text-text-tertiary text-button-sm-medium`
- 커스텀 스타일 필요 시 `style` prop 사용
