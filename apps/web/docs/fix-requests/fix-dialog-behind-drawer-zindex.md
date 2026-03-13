# Dialog가 Drawer 뒤에 가려지는 z-index 문제

## 현상

- Drawer(상세 보기) 안에서 버튼을 클릭해 Dialog를 열면, Dialog가 Drawer **뒤에** 표시됨
- 예: DB고객정보 상세 Drawer → "녹취파일 확인" 버튼 클릭 → Dialog가 Drawer 뒤에 가려짐

## 원인

1. AI가 커스텀 Drawer를 `z-[50]`으로 생성
2. @aplus/ui `Dialog` 컴포넌트는 내부적으로 z-index `40`(backdrop) / `41`(dialog) 사용
3. Dialog(41) < 커스텀 Drawer(50) → Dialog가 뒤에 깔림

## 현재 임시 해결 (프롬프트)

AI에게 커스텀 Drawer z-index를 `z-[30]`/`z-[31]`로 생성하도록 규칙 추가 완료.
→ Dialog(z-40/41)가 항상 Drawer(z-30/31) 위에 표시됨.

## 근본 해결: @aplus/ui Drawer를 UMD 번들에 추가

### 배경

- `@aplus/ui`에 `Drawer` 컴포넌트가 이미 구현되어 있음 (`storybook-standalone/packages/ui/src/components/Drawer.tsx`)
- `Drawer`는 `Dialog`와 동일한 `useModalStack` 훅을 사용하여 z-index 자동 관리
- 하지만 `index.ts`에서 export하지 않아 UMD 번들에 포함되지 않음

### 수정 방법

#### 수정 1: Drawer export 추가

`storybook-standalone/packages/ui/src/components/index.ts`

```typescript
// 기존
export * from './Dialog';

// 아래 추가
export * from './Drawer';
```

#### 수정 2: UMD 번들 재빌드

```bash
cd storybook-standalone/packages/ui && pnpm build:umd
```

#### 수정 3 (선택): ModalStackProvider 적용

iframe 프리뷰에서 중첩 모달(Drawer → Dialog)의 z-index를 자동 관리하려면:

`apps/web/components/features/preview/code-preview-iframe.tsx`의 iframe HTML에서 root 렌더링 부분에 ModalStackProvider 추가:

```javascript
// 기존
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));

// 변경
ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(AplusUI.ModalStackProvider, null, React.createElement(App))
);
```

### 수정 후 기대 동작

- AI가 `<Drawer>` 컴포넌트를 직접 사용 (커스텀 div 대신)
- Drawer와 Dialog의 z-index가 `useModalStack`에 의해 자동 관리
- Drawer 위에 Dialog가 열리면 자동으로 더 높은 z-index 할당

## 영향 범위

- 프리뷰 iframe 내 Drawer/Dialog 스태킹만 해당
- 기존 Dialog 동작에 영향 없음
