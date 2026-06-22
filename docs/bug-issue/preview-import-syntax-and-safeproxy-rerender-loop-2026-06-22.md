# 프리뷰 디버깅 — import SyntaxError(무음 실패) & safeProxy 무한 리렌더 루프

- 날짜: 2026-06-22
- 관련: PR #154 / 커밋 `49b917e6` (프리뷰 safeProxy ownKeys invariant 위반 수정)
- room: `54d310e9-2f53-49ea-bf35-b067dba32427`
- 대상 파일: `apps/web/components/features/preview/code-preview-iframe.tsx`
- 분석 방식: 실제 생성 코드(Supabase `chat_messages.content`) 3건 + 콘솔 로그 + **헤드리스 브라우저 재현 실험**으로 검증

## 추적한 메시지

| mid(앞 8) | path | 증상 |
| --- | --- | --- |
| `ef66226a` | `DuplicateCustomerCheckDialog.tsx` (v1, 10271자) | 정상 렌더 (실제로는 **보이지 않는** 무한 루프 — 아래 [항목 2] 참고) |
| `aa14d83b` | `CustomerTestPage.tsx` (2227자) | **렌더 X + 에러 UI도 X** → [디버깅 항목 1] |
| `402b3841` | `DuplicateCustomerCheckDialog.tsx` (v2, 8324자) | 렌더는 되지만 버튼/그리드 무한 플리커 → [디버깅 항목 2] |

---

## [디버깅 항목 1] `Cannot use import statement outside a module` — 무음 실패

### 결론 (근본 원인)
AI 생성 코드 `aa14d83b`의 2번째 줄:

```ts
import DuplicateCustomerCheckDialog from '@/components/DuplicateCustomerCheckDialog';
```

이 **서브경로(sub-path)에서의 default import**가 import 제거 로직을 통과해 살아남아, iframe 의 일반 `<script>`(=`type="module"` 아님)에 그대로 주입 → 파싱 단계에서 `SyntaxError: Cannot use import statement outside a module` 발생.

### 왜 안 잡히나 — import 제거가 allow-list(화이트리스트) 기반
`code-preview-iframe.tsx`의 import 제거(223–255행)는 **알려진 모듈 지정자(specifier)만** 정규식으로 지운다:

- `import { ... } from '@/components'` (정확히 bare specifier만)
- `import React, { ... } from 'react'` 등 react 변형
- `ag-grid-react`, `ag-grid-community`, `@/themes/agGridTheme`, `@aplus/ui`

하지만 다음은 **어떤 정규식에도 매칭되지 않는다**:
- `import X from '@/components/<서브경로>'` ← 이번 케이스
- 그 외 임의 모듈의 default/namespace/side-effect import (`import x from 'lib'`, `import * as x ...`, `import 'foo'`, `import { a } from 'date-fns'` 등)

검증 (실제 코드에 strip 정규식 전부 적용 후 살아남는 import):
```
SURVIVING import lines (aa14d83b):
  > import DuplicateCustomerCheckDialog from '@/components/DuplicateCustomerCheckDialog';
```

Sucrase 는 `transforms: ['jsx', 'typescript']` 로만 호출된다(300–303행). **`'imports'` 트랜스폼이 없으므로 ESM import 구문을 변환/제거하지 않고 그대로 통과**시킨다 → SyntaxError 확정.

### 왜 "에러 UI조차" 안 뜨나 (핵심)
프리뷰의 모든 방어 장치(`try { ... } catch`로 빨간 "렌더링 에러" 박스 표시 / `window.addEventListener('error', ...)` 런타임 배너)는 **전부 같은 인라인 `<script>` 안에 정의**되어 있다(712–1077행).

`import` 로 인한 **SyntaxError 는 파싱 단계 에러**다. 스크립트 자체가 컴파일되지 않으므로 그 안의 `try/catch`도, `window.onerror` 핸들러도 **등록조차 되지 않는다**. 따라서:
- `#root` 는 비어 있고(렌더 X)
- 빨간 에러 박스/배너도 안 뜨고(에러 UI X)
- 오직 브라우저 devtools 콘솔의 `Uncaught SyntaxError` 만 남는다.

→ 사용자가 본 "렌더링도 안 되고, 렌더링 에러도 표시되지 않음" 증상과 정확히 일치.

> 참고: 콘솔의 `[Preview] 누락된 prop 접근: "initialData"` 경고는 **`ef66226a`(정상 동작 버전)** 가 standalone 으로 렌더되며 출력한 것으로, `aa14d83b` 의 무음 실패와는 별개의(양성) 로그다.

### 부가 한계 (스코프 노트)
설령 이 import 를 제거하더라도 `DuplicateCustomerCheckDialog` 는 **프로젝트 로컬 컴포넌트**라 프리뷰 샌드박스에 존재하지 않는다. 자동 매핑(`autoDetectedComponents`)은 `AVAILABLE_APLUS_COMPONENTS`(@aplus/ui UMD) 한정이므로 임의 로컬 모듈은 stub 이 안 생긴다 → `DuplicateCustomerCheckDialog` 는 `undefined` 가 되어 `React.createElement(undefined, ...)` 크래시. 즉 **프리뷰는 self-contained 단일 컴포넌트 대상**이며, 로컬 모듈을 조합하는 "페이지" 코드는 근본적으로 미지원이다.

### 권장 수정 방향 (구현 전 제안)
1. **잔여 import 무조건 제거**: 컴포넌트 이름 추출(매핑용)을 먼저 끝낸 뒤, 남아있는 모든 `import ...;` / `import '...';` 구문을 specifier 무관하게 blanket-strip. (또는 Sucrase 에 `'imports'` 트랜스폼 추가 — 단, CJS `require` 가 생기므로 blanket-strip 이 더 안전.)
2. **무음 실패 제거**: import 잔존/미해결 식별자를 **React/TS 레이어**(srcDoc 생성 `useMemo` 의 `try/catch`)에서 검출해 기존 `error` state("코드 변환 에러" 빨간 박스)로 노출. iframe 안에서 조용히 죽지 않고 화면에 뜨게.
3. (선택) 로컬 모듈 import 감지 시 "프리뷰 미지원(단일 컴포넌트만)" 안내 메시지 표시.

---

## [디버깅 항목 2] safeProxy identity 불안정 → 무한 리렌더 루프 (하니스 회귀)

### 결론 (근본 원인)
이것은 `402b3841` 고유 버그가 **아니다**. `__PreviewWrapper` 의 safeProxy fallback(923–939행)이 유발하는 **하니스(프리뷰 런타임) 레벨 회귀**다.

```js
function __PreviewWrapper(realProps) {
  const base = realProps || {};
  const safeProps = new Proxy(base, {
    get: function (t, prop) {
      if (typeof prop === 'symbol') return t[prop];
      if (prop in t) return t[prop];
      __reportMissingProp(prop);
      return createSafeProxy();   // ← 접근할 때마다 "새 객체" 반환
    },
    ...
  });
  return __UserComponent(safeProps);
}
```

`PREVIEW_DEFAULTS = { open, isOpen, onClose, onOpenChange }` 에 `initialData` 가 없으므로 `safeProps.initialData` 접근 시마다 **매번 새로운 `createSafeProxy()` 인스턴스**(새 identity)가 반환된다.

두 생성 코드 모두 동일 패턴:
```ts
useEffect(() => {
  if (open) { ... setState(...) ... }
}, [open, initialData]);   // ← initialData 가 의존성 배열에 있음
```

`__UserComponent` 의 hooks 는 `__PreviewWrapper` 의 fiber 에서 실행된다(`__UserComponent(safeProps)` 직접 호출). setState 발생 → `__PreviewWrapper` 재실행 → 새 `safeProps` → `initialData` 새 proxy → `Object.is(prev, next) === false` → **effect 가 매 렌더마다 재실행 → setState → 렌더 → … 무한 루프**.

### ef66226a 가 "정상"으로 보인 이유 (역설 해소)
헤드리스 브라우저 재현 실험 결과 **두 버전 모두 무한 루프**(가드 200회 컷):

```
A: RENDER_RUNAWAY >200   (ef66226a 형: Object.keys(initialData).length>0 가드 → handleReset 분기)
B: RENDER_RUNAWAY >200   (402b3841 형: if(initialData) → handleSearch 분기)
FINAL renderA=201 renderB=201
```

차이는 "루프 유무"가 아니라 **루프 1회당 출력이 시각적으로 변하느냐**다:

- **`ef66226a`**: `handleReset()` 이 항상 동일한 값(빈 폼, 빈 그리드, `isSearched=false`)으로 setState → 매 렌더 DOM 이 **동일** → 눈에 안 보이는 루프 (정적 렌더처럼 보임, CPU 만 점유).
- **`402b3841`**: `if(initialData)`(proxy 는 truthy) → `handleSearch` 자동 실행 → `mockResults` 가 `Math.random() > 0.3` 으로 0/1행을 오가고, 푸터 버튼 `interaction` 이 `hasSearched && rowData.length === 0` 에 의존 → **행 개수·버튼 활성화가 매 루프마다 토글 → 가시적 플리커**.

즉 "신규 고객 등록" 버튼과 ag-grid 가 깜빡이는 것은 무한 루프의 **가시적 증상**이다.

> proxy 가 truthy 인 점도 작동한다: `Object.keys(safeProxy)` 는 target 이 `function(){}` 이고 own key(length/name/prototype)가 모두 non-enumerable 이라 `[]`(length 0). 그래서 `ef66226a` 는 EMPTY 분기, `402b3841` 의 `if(initialData)` 는 truthy 라 PREFILL 분기를 탄다.

### 제외한 가설
- DataGrid 래퍼의 `measuredH` ResizeObserver 루프: `height={300}`(숫자)이라 `measuredH` 경로가 effectiveHeight 에 영향 없음 → 주원인 아님.
- AgGridReact 의 `useEffect([props.rowData])` → `setGridOption`: React 재렌더를 유발하지 않음 → 주원인 아님.

### 권장 수정 방향 (구현 전 제안)
독립적인 **두 결함**으로 분리해 다뤄야 한다:

1. **identity 불안정 (= 루프의 직접 원인)** — *주 수정 대상*
   누락 prop 의 safeProxy 를 **prop 이름별로 캐싱(메모이즈)** 하여 매 렌더 동일 인스턴스를 반환. iframe 스크립트의 모듈 레벨(예: `__reportedMissingProps` 옆)에 prop 이름 키 캐시를 두면 됨(프리뷰는 컴포넌트 인스턴스 1개라 안전).
   재현 실험에서 **메모이즈 적용 시 201회 → 2회**로 루프 소멸 확인:
   ```
   rendersWithMemo: 2
   ```
   `createSafeProxy` 내부 체이닝(`a.b.c`)도 동일 캐싱이 필요(중첩 키 경로 기준)할 수 있음.

2. **truthiness (= 분기 오선택)** — 부차적 정합성 이슈
   identity 만 고치면 루프는 멈추지만, proxy 는 여전히 truthy 라 `402b3841` 은 PREFILL 분기를 타 (실데이터 없이) handleSearch 를 1회 실행한다. 완전 정합을 위해 **top-level 누락 prop 은 안정적인 `undefined` 반환**이 이상적(→ `if(initialData)` false → EMPTY 분기, 의존성 안정).
   단, 이는 `49b917e6` safeProxy 가 흡수하려던 **체이닝 크래시**(`initialFilters.coalCoCd` 같은 미주입 도메인 객체 직접 접근 시 `undefined.x`)를 다시 노출시킨다. 즉 **"top-level: 안정 undefined로 올바른 분기" vs "deep: proxy로 크래시 흡수"** 사이의 설계 트레이드오프가 본 이슈의 핵심 결정 포인트다.

   현실적 권고: **(1) 메모이즈로 루프부터 차단**(사용자 실 증상 해소). (2) truthiness 정합은 별도 결정 — top-level prop 만 안정 falsy 로 바꾸고 deep access 는 proxy 유지하는 하이브리드가 균형점.

---

## 요약

| 항목 | 근본 원인 | 위치 | 1차 권장 |
| --- | --- | --- | --- |
| 1 | 서브경로 default import 가 allow-list 제거를 통과 → 일반 script 에 주입 → 파싱 SyntaxError → try/catch·onerror 자체가 죽어 무음 실패 | strip 정규식 223–255행, Sucrase 300–303행 | 잔여 import blanket-strip + React 레이어에서 검출해 에러 UI 노출 |
| 2 | `__PreviewWrapper` safeProxy 가 누락 prop 접근마다 새 identity 반환 → hook 의존성 배열에서 매 렌더 재실행 → setState 무한 루프 (가시 여부만 버전차) | safeProxy 858–894행 / `__PreviewWrapper` 923–939행 | prop 이름별 proxy 메모이즈(201→2 검증). truthiness 정합은 별도 트레이드오프 결정 |
