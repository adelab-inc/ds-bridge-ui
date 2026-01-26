# JSON 산출물 비교 분석

> Design System Runtime Hub 문서 기준으로 3개 JSON 산출물의 특징, 구현 정도, 목적 적합성을 비교 분석합니다.

---

## 비교 대상

| 파일                  | 경로                          | 설명                         |
| --------------------- | ----------------------------- | ---------------------------- |
| react.old.ds.json     | `apps/web/public/ds-schemas/` | 구 버전 Public URL Extractor |
| react.ds.json         | `apps/web/public/ds-schemas/` | 신 버전 Public URL Extractor |
| component-schema.json | `storybook-standalone/dist/`  | 자체 Storybook 빌드          |

---

## 기본 정보 비교

| 항목            | react.old.ds.json | react.ds.json    | component-schema.json        |
| --------------- | ----------------- | ---------------- | ---------------------------- |
| **크기**        | 128KB (5,294줄)   | 196KB (7,826줄)  | 52KB (2,293줄)               |
| **토큰 크기**   | ~33K              | ~55K             | ~2.3K                        |
| **컴포넌트 수** | 128개             | 128개            | 22개                         |
| **소스**        | Carbon DS (외부)  | Carbon DS (외부) | @aplus/ui (내부)             |
| **생성일**      | 2026-01-22        | 2026-01-25       | 2026-01-16                   |
| **스키마 형식** | DSJson (Array)    | DSJson (Array)   | ComponentSchemaJson (Object) |

---

## 스키마 구조 비교

### 1. react.old.ds.json (구버전) | 260122 기준 스토리북 URL 추출 JSON

```json
{
  "name": "react",
  "source": "https://react.carbondesignsystem.com",
  "components": [
    {
      "name": "Button",
      "category": "Components",
      "stories": ["Default", "Danger", "Ghost"],
      "props": [
        {
          "name": "propertyName",
          "type": ["unknown"],
          "defaultValue": "defaultValue"
        }
      ]
    }
  ]
}
```

### 2. react.ds.json (신버전) | 260126 기준 스토리북 URL 추출 JSON

```json
{
  "name": "react",
  "source": "https://react.carbondesignsystem.com",
  "version": "1.0.0",
  "extractedAt": "2026-01-25T23:46:18.035Z",
  "components": [
    {
      "name": "Button",
      "category": "Components",
      "filePath": "./src/components/Button/Button.stories.js",
      "tags": ["dev", "test", "autodocs"],
      "stories": [{ "id": "components-button--default", "name": "Default" }],
      "props": [
        {
          "name": "propertyName",
          "type": ["unknown"],
          "required": false
        }
      ]
    }
  ]
}
```

### 3. component-schema.json (내부 DS)

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-01-16T04:42:02.031Z",
  "components": {
    "Button": {
      "displayName": "Button",
      "filePath": "packages/ui/src/components/Button.tsx",
      "category": "UI",
      "props": {
        "variant": {
          "type": [
            "destructive",
            "outline",
            "primary",
            "secondary",
            "tertiary"
          ],
          "required": false
        },
        "size": {
          "type": ["lg", "md", "sm"],
          "required": false
        },
        "isLoading": {
          "type": "boolean",
          "required": false
        }
      },
      "stories": [
        {
          "id": "ui-button--primary",
          "name": "Primary",
          "tags": ["dev", "test", "autodocs", "play-fn"]
        }
      ]
    }
  }
}
```

---

## 핵심 비교표

| 항목                   | react.old.ds.json |  react.ds.json   | component-schema.json |
| ---------------------- | :---------------: | :--------------: | :-------------------: |
| **Props 추출**         |  ❌ 플레이스홀더  | ❌ 플레이스홀더  |    ✅ 실제 데이터     |
| **타입 정보**          |   ❌ "unknown"    |   ❌ "unknown"   |    ✅ 정확한 타입     |
| **옵션 값**            |      ❌ 없음      |     ❌ 없음      | ✅ variant/size 옵션  |
| **Story ID**           |     ❌ 이름만     |   ✅ id + name   |  ✅ id + name + tags  |
| **filePath**           |      ❌ 없음      |     ✅ 있음      |        ✅ 있음        |
| **tags**               |      ❌ 없음      | ✅ 컴포넌트 레벨 |    ✅ 스토리 레벨     |
| **required 필드**      |      ❌ 없음      |     ✅ 있음      |        ✅ 있음        |
| **defaultValue**       |      ❌ 더미      |     ❌ 더미      |       ✅ 실제값       |
| **description**        |      ❌ 더미      |     ❌ 더미      |     ✅ 실제 설명      |
| **O(1) 컴포넌트 조회** |        ❌         |        ❌        |          ✅           |

---

## Hub 목적 적합성 평가

### Design System Runtime Hub의 핵심 요구사항

[Design_System_Runtime_Hub_Summary.md](./Design_System_Runtime_Hub_Summary.md) 기준 Hub의 목표:

1. **1막**: "컴포넌트 클릭 시 실제 화면 표시" → Story 실행
2. **2막**: "Props 패널에서 값 변경" → Props 편집 UI
3. **3막**: "AI가 JSON 분석하여 컴포넌트 조합" → Props 정보 필수

### 적합성 점수

| 파일                  | 1막 (실행) | 2막 (편집) | 3막 (AI 조합) |   종합   |
| --------------------- | :--------: | :--------: | :-----------: | :------: |
| react.old.ds.json     |  ⚠️ 부분   |  ❌ 불가   |    ❌ 불가    |   20%    |
| react.ds.json         |  ✅ 가능   |  ❌ 불가   |    ❌ 불가    |   40%    |
| component-schema.json |  ✅ 가능   |  ✅ 가능   |    ✅ 가능    | **100%** |

### 상세 분석

#### react.old.ds.json (20%)

- **1막**: Story 이름만 있어 실행은 가능하나, Story ID가 없어 Storybook iframe URL 생성 어려움
- **2막**: Props가 모두 플레이스홀더여서 편집 패널 구성 불가
- **3막**: AI가 컴포넌트 조합 시 필요한 props 정보 없음

#### react.ds.json (40%)

- **1막**: ✅ Story ID가 있어 Storybook iframe 렌더링 가능
- **2막**: ❌ Props가 여전히 플레이스홀더
- **3막**: ❌ AI가 활용할 수 있는 실제 props 정보 없음

#### component-schema.json (100%)

- **1막**: ✅ Story ID + tags로 완벽한 실행 지원
- **2막**: ✅ 실제 props (variant, size, isLoading 등)로 편집 패널 구성 가능
- **3막**: ✅ AI가 `Button(variant='primary', size='lg')` 형태로 조합 가능

---

## 구현 정도 평가

| 항목               | react.old  |  react.ds  | component-schema |
| ------------------ | :--------: | :--------: | :--------------: |
| 컴포넌트 목록      |     ✅     |     ✅     |        ✅        |
| 스토리 실행 가능   | ⚠️ ID 없음 | ✅ ID 있음 |    ✅ ID 있음    |
| Props 편집 가능    |     ❌     |     ❌     |        ✅        |
| AI 분석 가능       |     ❌     |     ❌     |        ✅        |
| 파일 경로 추적     |     ❌     |     ✅     |        ✅        |
| O(1) 컴포넌트 조회 |     ❌     |     ❌     |        ✅        |

---

## Props 추출 실패 근본 원인 분석

### 두 가지 추출 방식 비교

| 구분          |     extract-component-schema.ts      |      storybook-extractor.ts      |
| ------------- | :----------------------------------: | :------------------------------: |
| **대상**      |         내부 DS (@aplus/ui)          |       외부 DS (Carbon 등)        |
| **입력**      |         TypeScript 소스 코드         |       Storybook URL (HTML)       |
| **방식**      | `react-docgen-typescript` (AST 분석) | Cheerio + Playwright (HTML 파싱) |
| **정확도**    |               ✅ 100%                |         ❌ 플레이스홀더          |
| **파일 위치** |   `storybook-standalone/scripts/`    |         `apps/web/lib/`          |

---

### 실패 원인 1: CSS 셀렉터 불일치

**storybook-extractor.ts**의 SELECTORS 정의:

```typescript
const SELECTORS = {
  table: [
    ".docblock-argstable", // Carbon DS 미사용
    '[class*="argstable"]', // argstable 클래스 없음
    'table[class*="args"]', // args 클래스 없음
    ".sbdocs-argtable", // Storybook 6 전용
    // ...
  ].join(", "),
};
```

**Carbon DS 실제 HTML 구조:**

```html
<!-- Carbon DS는 CSS 클래스 없이 시맨틱 HTML 사용 -->
<table>
  <!-- 클래스 없음! -->
  <tr role="row">
    <td role="cell">
      <span role="generic">union</span>
      <!-- role로 타입 표시 -->
    </td>
  </tr>
</table>
```

→ 셀렉터가 테이블을 찾지 못해 빈 배열 반환

---

### 실패 원인 2: Playwright API 추출 실패

```typescript
// playwright-extractor.ts
export async function extractPropsViaStorybookAPI(page: Page) {
  const storyData = await page.evaluate(() => {
    // Storybook 7+ API 시도
    const preview = window.__STORYBOOK_PREVIEW__;
    if (preview?.storyStore) {
      /* ... */
    }

    // Storybook 6 API 시도
    const legacyStore = window.__STORYBOOK_STORY_STORE__;
    if (legacyStore) {
      /* ... */
    }

    return null; // 둘 다 실패
  });
}
```

**실패 이유:**

- Carbon DS가 `__STORYBOOK_PREVIEW__`를 노출하지 않거나
- argTypes가 API에 포함되지 않음
- iframe 내부에서 접근 불가

---

### 실패 원인 3: Cascade 효과

```
1. Cheerio 파싱 시도
   └─ 테이블 셀렉터 실패 → 빈 배열 반환

2. needsPlaywright = true 감지 (line 282)

3. Playwright 재시도
   ├─ API 추출 시도 → null 반환
   └─ HTML 파싱 폴백 → 동일한 셀렉터 실패

4. 플레이스홀더 감지 (line 349)
   └─ isPlaceholder() 함수가 true 반환

5. 최종 플레이스홀더 생성 (line 595)
   └─ name: "propertyName"
   └─ type: ["unknown"]
   └─ defaultValue: "defaultValue"
```

---

### 성공 사례: 내부 DS 추출 방식

```typescript
// extract-component-schema.ts
const parser = withCompilerOptions(
  {
    esModuleInterop: true,
    jsx: 4, // ReactJSX
  },
  {
    savePropValueAsString: true,
    shouldExtractLiteralValuesFromEnum: true, // enum 값 추출
    shouldRemoveUndefinedFromOptional: true,
  },
);

// TypeScript 파일 직접 분석
const docs: ComponentDoc[] = parser.parse(targetPath);
```

**장점:**

- 소스 코드 직접 접근으로 HTML 파싱 불필요
- AST 기반으로 정확한 타입 정보 추출
- enum/union 타입 완벽 파싱

---

## 해결 방안 제안

| 우선순위 | 방안                                     | 난이도 |   효과    |
| :------: | ---------------------------------------- | :----: | :-------: |
|    1     | Carbon DS용 시맨틱 HTML 셀렉터 추가      |  낮음  |   중간    |
|    2     | `table` 일반 셀렉터 폴백 추가            |  낮음  |   중간    |
|    3     | Storybook Index API (`/index.json`) 활용 |  중간  |   높음    |
|    4     | `role="generic"` 속성 기반 파싱          |  중간  |   높음    |
|    5     | DS별 커스텀 파서 플러그인 시스템         |  높음  | 매우 높음 |

---

## 결론 및 권장사항

### 현재 상태

| 파일                  | 상태             | 용도                        |
| --------------------- | ---------------- | --------------------------- |
| react.old.ds.json     | 🔴 폐기 대상     | -                           |
| react.ds.json         | 🟡 스키마만 개선 | Story 실행용 (Props 미지원) |
| component-schema.json | 🟢 프로덕션 레디 | 완전한 Hub 기능 지원        |

### 권장 액션

1. **단기**: component-schema.json 형식을 Hub의 표준으로 채택
2. **중기**: Carbon DS용 Props 추출 로직 개선 (ArgTypes 파싱 방식 변경)
3. **장기**: 4막(사용자 DS 연동) 위해 범용 extractor 개발 필요

---

## 부록: 데이터 품질 상세

### component-schema.json 우수 사례

```json
{
  "content": {
    "type": "ReactNode",
    "required": true,
    "description": "툴팁에 표시될 내용"
  },
  "delay": {
    "type": "number",
    "required": false,
    "defaultValue": 200,
    "description": "툴팁 표시 지연 시간 (ms)"
  },
  "preferredPosition": {
    "type": ["top", "bottom", "left", "right"],
    "required": false,
    "defaultValue": "top",
    "description": "초기 위치 우선순위"
  }
}
```

### Carbon DS Props 추출 실패 예시

```json
{
  "name": "propertyName",
  "description": "This is a short description",
  "type": ["unknown"],
  "defaultValue": "defaultValue"
}
```

---

## 관련 문서 및 파일

### 문서

- [Design_System_Runtime_Hub_Summary.md](./Design_System_Runtime_Hub_Summary.md) - DS Runtime Hub 로드맵
- [storybook-extractor-analysis.md](./storybook-extractor-analysis.md) - Storybook Extractor 분석
- [ds-hub-storybook-extraction.md](../specs/ds-hub-storybook-extraction.md) - 추출 스펙

### 소스 파일

| 파일                                                       | 역할            |
| ---------------------------------------------------------- | --------------- |
| `apps/web/lib/storybook-extractor.ts`                      | 메인 추출 로직  |
| `apps/web/lib/playwright-extractor.ts`                     | Playwright 폴백 |
| `storybook-standalone/scripts/extract-component-schema.ts` | 내부 DS 추출    |
