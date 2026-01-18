# AI 코드 프리뷰 디버깅 가이드

AI가 생성한 React 코드를 iframe에서 렌더링할 때 발생할 수 있는 문제들과 해결 방법을 정리합니다.

## 컴포넌트 Props 호환성 이슈

### Chip 컴포넌트

**문제**: AI가 `value` prop에 텍스트를 전달하지만, 원래 Chip은 `children`으로 텍스트를 받음

**AI 생성 코드:**
```jsx
<Chip value="화면 분할 도구" size="sm" state="selected" selectionStyle="single" />
```

**올바른 사용법:**
```jsx
<Chip size="sm" state="selected" selectionStyle="single">화면 분할 도구</Chip>
```

**해결**: Chip 컴포넌트에서 `value` prop을 `children` 대신 사용할 수 있도록 수정
- `storybook-standalone/packages/ui/src/components/Chip.tsx`
- `const content = children || value;`로 처리

---

## 누락된 컴포넌트 이슈

### 증상
- 컴포넌트가 점선 박스와 `[ComponentName]` 텍스트로 표시됨
- 콘솔에 `Missing components from @aplus/ui: ComponentName` 경고

### 원인
`@aplus/ui`에 해당 컴포넌트가 없거나 export되지 않음

### 해결 방법

1. **컴포넌트 파일 존재 여부 확인:**
   ```bash
   ls storybook-standalone/packages/ui/src/components/*.tsx
   ```

2. **index.ts에 export 추가:**
   ```ts
   // storybook-standalone/packages/ui/src/components/index.ts
   export * from './ComponentName';
   ```

3. **UMD 번들 재빌드:**
   ```bash
   cd storybook-standalone/packages/ui
   pnpm build:umd
   ```

### 추가된 컴포넌트 목록
- Heading (신규 생성)
- Chip, ChipGroup
- Select
- Checkbox, Field, Option, OptionGroup, Radio, ToggleSwitch
- Dialog, TagGroup
- IconButton, Link
- Menu, Scrollbar

---

## iframe 렌더링 에러

### React error #130: Element type is invalid

**증상:**
```
Element type is invalid: expected a string or class/function but got: undefined
```

**원인:**
- 컴포넌트가 `window.AplusUI`에 없음
- 컴포넌트 이름 추출 실패

**디버깅:**
1. 콘솔에서 `[Preview Debug]` 로그 확인
2. `window.AplusUI` 객체 확인: `Object.keys(window.AplusUI)`

### Dynamic require 에러

**증상:**
```
Dynamic require of "react" is not supported
Dynamic require of "react/jsx-runtime" is not supported
```

**원인:**
esbuild UMD 빌드에서 React를 external로 처리하지 않음

**해결:**
`esbuild.config.mjs`에 shim 플러그인 추가:
- `react` → `window.React`
- `react-dom` → `window.ReactDOM`
- `react/jsx-runtime` → custom jsx 함수

---

## export 패턴 지원

`CodePreviewIframe`에서 지원하는 export 패턴:

| 패턴 | 예시 | 추출되는 이름 |
|------|------|--------------|
| Named function | `export default function MyComp() {}` | `MyComp` |
| Named export | `const App = () => {}; export default App;` | `App` |
| Anonymous | `export default () => {}` | `App` (자동 생성) |

---

## 빠른 체크리스트

1. [ ] 컴포넌트가 `@aplus/ui`에 존재하는가?
2. [ ] `components/index.ts`에 export되어 있는가?
3. [ ] UMD 번들이 최신인가? (`pnpm build:umd`)
4. [ ] Props가 실제 컴포넌트 API와 일치하는가?
5. [ ] export 패턴이 지원되는 형식인가?
