# Storybook Extractor 분석 결과

> **분석 일자**: 2026-01-22
> **대상**: Carbon Design System (`https://react.carbondesignsystem.com`)
> **추출 소요 시간**: 18분 → **6.8초** (개선 후)
> **구현 커밋**: `bdca21b3`

---

## 1. 산출물 현황

| 항목 | 값 | 평가 |
|------|-----|------|
| 컴포넌트 수 | 128개 | ✅ 양호 |
| 스토리 | 추출됨 | ✅ 양호 |
| Props | **381개 모두 placeholder** | ❌ 부적합 |

### Props 품질 문제

```json
// 현재 산출물 (모든 컴포넌트 동일)
{
  "name": "Button",
  "props": [
    { "name": "propertyName", "type": ["unknown"], "defaultValue": "defaultValue" },
    { "name": "propertyName", "type": ["unknown"], "defaultValue": "defaultValue" }
  ]
}

// 필요한 산출물
{
  "name": "Button",
  "props": [
    { "name": "variant", "type": ["primary", "secondary", "danger"], "defaultValue": "primary" },
    { "name": "size", "type": ["sm", "md", "lg"], "defaultValue": "md" },
    { "name": "disabled", "type": ["boolean"], "defaultValue": "false" }
  ]
}
```

**원인**: Carbon Design System Storybook은 **CSR(Client-Side Rendering)** 방식이라 ArgTypes 테이블이 JavaScript 실행 후에만 렌더링됨. Playwright 재시도도 해당 Storybook의 ArgTypes 테이블 구조가 표준과 달라 파싱 실패.

---

## 2. 문서 요구사항 대비 적합성

> 기준 문서: `docs/hub/Design_System_Runtime_Hub_Summary.md`

| 막 | 요구사항 | 현재 상태 | 적합 |
|----|---------|----------|------|
| **1막** | 컴포넌트 클릭 → 실제 화면 표시 | 스토리로 iframe 렌더링 가능 | ⚠️ 부분 |
| **2막** | Props 패널에서 variant, size 변경 | props가 `propertyName`만 존재 | ❌ 불가 |
| **3막** | AI가 JSON 분석하여 조합 | 실제 props 정보 없음 | ❌ 불가 |
| **4막** | Storybook → ds.json 추출 | 추출은 되나 품질 낮음 | ⚠️ 부분 |

---

## 3. iframe 미리보기 가능 여부

### Story ID 변환 패턴

| ds.json 데이터 | 실제 Storybook ID |
|---------------|------------------|
| category: `Components`, name: `Button`, story: `Default` | `components-button--default` |
| category: `Components`, name: `Button`, story: `Danger` | `components-button--danger` |

### 변환 공식

```typescript
function buildStoryId(category: string, name: string, story: string): string {
  const prefix = `${category}/${name}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\//g, '-');

  const suffix = story.toLowerCase().replace(/\s+/g, '-');

  return `${prefix}--${suffix}`;
}

// 예시
buildStoryId("Components", "Button", "Default")
// → "components-button--default"
```

### iframe URL 생성

```typescript
const iframeUrl = `${source}/iframe.html?id=${storyId}&viewMode=story`;

// 예시
// https://react.carbondesignsystem.com/iframe.html?id=components-button--default&viewMode=story
// ✅ HTTP 200 확인됨
```

### 결론

| 기능 | 가능 여부 | 비고 |
|------|----------|------|
| 컴포넌트 목록 표시 | ✅ | 128개 컴포넌트 |
| 스토리 목록 표시 | ✅ | 각 컴포넌트별 스토리 |
| iframe 미리보기 | ✅ | `category + name + story` → storyId 변환 필요 |
| Props 편집 | ❌ | placeholder 데이터 |

**현재 산출물만으로 1막(Authority 확보) 목표 달성 가능**

---

## 4. 성능 문제 분석

### 18분 소요 원인

| 단계 | 처리 방식 | 소요 시간 |
|------|----------|----------|
| Cheerio (128개) | 병렬 5개씩 | ~30초 |
| **Playwright 재시도 (128개)** | **순차 처리** | **~17분** |

### 병목: Playwright 순차 처리

```
128개 컴포넌트 × 순차 재시도 × 약 8초/건 = 1,024초 ≈ 17분
```

브라우저 충돌 문제 해결을 위해 Playwright를 순차 처리로 변경한 것이 18분의 원인.

---

## 5. 성능 개선 방안 ✅ 구현 완료

> **커밋**: `bdca21b3` - ⚡ Perf: Playwright 비활성화 옵션 및 조기 종료 로직 추가

### Option A: Playwright 비활성화 ✅

```bash
curl -X POST "http://localhost:5555/api/ds/extract?playwright=false&stream=true" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://react.carbondesignsystem.com"}'
```

- Cheerio만 사용
- 품질 동일 (어차피 Carbon은 Playwright도 실패)

### Option C: 스마트 재시도 ✅

- Playwright 실패 **5회 연속** 시 나머지 건너뛰기
- 기본값으로 적용됨 (`playwrightMaxFailures: 5`)

---

## 6. 실제 테스트 결과

### 테스트 환경

- URL: `https://react.carbondesignsystem.com`
- 컴포넌트: 128개

### 성능 비교

| 설정 | 소요 시간 | 산출물 |
|------|----------|--------|
| 개선 전 (Playwright 순차) | **18분** | react.ds.json |
| `?playwright=false` | **6.8초** | 동일 |
| 기본 (5회 실패 후 중단) | **30.1초** | 동일 |

### 핵심 결과

- **158배 성능 향상**: 18분 → 6.8초
- **산출물 동일**: 세 가지 방식 모두 동일한 JSON 산출물 생성
- **품질 영향 없음**: Carbon은 CSR 기반이라 Playwright로도 props 추출 실패하므로, 비활성화해도 품질 손실 없음

### 사용 가이드

```bash
# CSR Storybook (Carbon, 대부분의 대형 DS) - 빠른 추출 권장
curl -X POST "http://localhost:5555/api/ds/extract?playwright=false&stream=true" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://react.carbondesignsystem.com"}'

# SSR Storybook (Chromatic 등) - 기본 설정 사용
curl -X POST "http://localhost:5555/api/ds/extract?stream=true" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.chromatic.com"}'
```

---

## 7. 향후 개선 방향

### ✅ 해결됨: 성능 문제

- 18분 → 6.8초 (158배 향상)
- `?playwright=false` 옵션 추가

### 미해결: Props 추출 품질 개선

1. **다른 Storybook 테스트**: SSR 기반이거나 ArgTypes가 명확한 Storybook (예: Chromatic 배포본)
2. **Props 소스 다변화**: TypeScript 타입 정의 파일이나 `*.stories.tsx`에서 직접 추출
3. **현재 산출물 활용 범위**: 컴포넌트 목록 + 스토리 기반 iframe 미리보기만 가능

### 핵심 결론

| 판정 | 이유 |
|------|------|
| **4막 목적에 부분 적합** | props 없이도 1막(컴포넌트 미리보기) 가능, 2막/3막은 불가 |
| **성능 문제 해결** | 18분 → 6.8초, 동일 산출물 |
