# Storybook-Standalone 동기화 가이드

이 문서는 `aplus-world-ui`에서 `storybook-standalone`으로 UI 라이브러리를 동기화하는 방법을 설명합니다.

---

## 경로 정보

| 구분 | 경로 |
|------|------|
| **소스** | `/Users/finelab-mini/Desktop/workspace/aplus-world-ui/packages/ui/` |
| **타겟** | `/Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/` |

---

## 동기화 대상 파일

### 1. design-tokens/ (4개 파일)
```
src/design-tokens/
├── color.json              # 컬러 팔레트, 시맨틱 컬러
├── component-definitions.json  # TailwindCSS 클래스 매핑
├── space.json              # 스페이싱 스케일
└── typography.json         # 폰트 스타일
```

### 2. components/ (전체 폴더)
- 모든 React 컴포넌트 (.tsx)
- 하위 폴더 포함 (Chart/, DataGrid/, Menu/, Pagination/, Toast/)

### 3. stories/ (전체 폴더)
- 모든 Storybook 스토리 파일 (.stories.tsx)

### 4. tokens/ (2개 파일)
```
src/tokens/
├── design-tokens.ts        # 토큰 TypeScript export
└── types.ts                # 타입 정의
```

### 5. styles/ (1개 파일)
```
src/styles/
└── globals.css             # 전역 CSS (Storybook preview에서 import)
```

### 6. hooks/ (전체 폴더)
```
src/hooks/
├── useBodyScrollLock.ts    # Body 스크롤 잠금
├── useControllableState.ts # Controlled/Uncontrolled 상태 관리
├── useEscapeKey.ts         # ESC 키 이벤트 핸들러
├── useFocusTrap.ts         # 포커스 트랩 (Dialog, Drawer)
├── useModalStack.ts        # 모달 z-index 스택 관리
├── usePagination.ts        # 페이지네이션 로직
├── usePopup.ts             # 팝업 위치/상태 관리
└── index.ts                # barrel export
```
- **참조하는 컴포넌트**: Dialog, Drawer, TreeMenu, Select, Pagination
- **참조하는 스토리**: usePopup.stories.tsx

### 7. utils/ (전체 폴더)
```
src/utils/
└── index.ts                # TruncateWithTooltip, MultiLineTruncateWithTooltip 등
```
- **참조하는 컴포넌트**: Select, Menu/Item

### 8. tailwind.preset.js (루트)
- TailwindCSS 프리셋 설정

---

## 동기화 명령어

### 전체 동기화 (권장)
```bash
# 1. design-tokens 복사
cp /Users/finelab-mini/Desktop/workspace/aplus-world-ui/packages/ui/src/design-tokens/*.json \
   /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/design-tokens/

# 2. components 복사
rm -rf /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/components/*
cp -r /Users/finelab-mini/Desktop/workspace/aplus-world-ui/packages/ui/src/components/* \
      /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/components/

# 3. stories 복사
rm -rf /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/stories/*
cp -r /Users/finelab-mini/Desktop/workspace/aplus-world-ui/packages/ui/src/stories/* \
      /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/stories/

# 4. hooks 복사
rm -rf /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/hooks/*
cp -r /Users/finelab-mini/Desktop/workspace/aplus-world-ui/packages/ui/src/hooks/* \
      /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/hooks/

# 5. utils 복사
rm -rf /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/utils/*
cp -r /Users/finelab-mini/Desktop/workspace/aplus-world-ui/packages/ui/src/utils/* \
      /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/utils/

# 6. tokens 복사
cp /Users/finelab-mini/Desktop/workspace/aplus-world-ui/packages/ui/src/tokens/design-tokens.ts \
   /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/tokens/
cp /Users/finelab-mini/Desktop/workspace/aplus-world-ui/packages/ui/src/tokens/types.ts \
   /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/tokens/

# 7. tailwind.preset.js 복사
cp /Users/finelab-mini/Desktop/workspace/aplus-world-ui/packages/ui/tailwind.preset.js \
   /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/

# 8. styles/globals.css 복사
cp /Users/finelab-mini/Desktop/workspace/aplus-world-ui/packages/ui/src/styles/globals.css \
   /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui/src/styles/
```

### 빌드 & 스키마 재생성
```bash
cd /Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone
pnpm install
pnpm build:storybook
```

`pnpm build:storybook`이 수행하는 작업:
1. `turbo build --filter=storybook` → Storybook 정적 빌드
2. `pnpm schema:extract` → `dist/component-schema.json` 재생성

---

## 검증 체크리스트

### 파일 크기 확인
```bash
ls -la packages/ui/src/design-tokens/
# component-definitions.json 크기 확인
```

### 스키마 타임스탬프 확인
```bash
head -5 dist/component-schema.json
# generatedAt이 오늘 날짜인지 확인
```

### Storybook 실행 테스트
```bash
pnpm dev:storybook
# http://localhost:6006 접속
```

**확인 항목:**
- [ ] 새 컴포넌트가 사이드바에 표시되는지
- [ ] 각 컴포넌트 스토리가 정상 렌더링되는지
- [ ] 콘솔에 에러가 없는지

---

## 롤백 방법
```bash
git checkout -- packages/ui/
git checkout -- dist/component-schema.json
```

---

## 참조 파일 의존성

### Storybook 빌드 시 참조하는 파일
- `turbo.json` → build task inputs: `src/**`, `.storybook/**`
- `turbo.json` → schema:extract inputs: `packages/ui/src/components/**`
- `apps/storybook/.storybook/main.ts` → stories 경로
- `apps/storybook/tailwind.config.js` → preset, component-definitions.json
- `apps/storybook/.storybook/preview.ts` → globals.css

### component-schema.json 생성 프로세스
1. Storybook 빌드 → `storybook-static/index.json` 생성
2. `scripts/extract-component-schema.ts` 실행
3. `react-docgen-typescript`로 컴포넌트 props 추출
4. `dist/component-schema.json` 생성

> **Compound Component fallback**: Dialog, Drawer 등 `forwardRef + as TypeCast` 패턴의 컴포넌트는
> `react-docgen-typescript`가 직접 파싱하지 못합니다. 스크립트가 `export interface XProps` +
> `.displayName = 'X'` 패턴을 감지하면 임시 래퍼 파일을 생성하여 props를 추출합니다.
> 이 패턴에 맞지 않는 새로운 compound component가 추가되면 fallback 로직 확장이 필요합니다.

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-27 | 최초 작성 |
| 2026-02-09 | hooks/, utils/ 동기화 대상 추가 (Dialog, Drawer, TreeMenu, Select, Menu/Item 참조) |
| 2026-02-09 | Compound Component fallback 로직 추가 (Dialog, Drawer props 추출) |
