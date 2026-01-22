# DS-Runtime Hub: Storybook 데이터 추출 기술 문서

> 이 문서는 DS-Runtime Hub 4막(사용자 DS 연동) 구현을 위한 기술 참고 문서입니다.

## 구현 상태

> ✅ **MVP 구현 완료** (2026-01-22)

### 구현 파일

| 파일 | 용도 | 라인 수 |
|------|------|---------|
| `apps/web/lib/storybook-extractor.ts` | 핵심 추출 로직 | 761줄 |
| `apps/web/lib/playwright-extractor.ts` | CSR Storybook 대응 | 100줄 |
| `apps/web/lib/extraction-cache.ts` | 결과 캐싱 | 184줄 |
| `apps/web/lib/schema-converter.ts` | 포맷 변환 | 229줄 |
| `apps/web/types/ds-extraction.ts` | 타입 정의 | 220줄 |
| `apps/web/app/api/ds/extract/route.ts` | API 엔드포인트 | 422줄 |

### 성능 지표

| 시나리오 | 소요 시간 | 비고 |
|---------|----------|------|
| 기존 (Playwright 순차) | 18분 | 느림 |
| 최적화 (Playwright 5회 실패 후 중단) | 30초 | 기본값 |
| `?playwright=false` | **6.8초** | 권장 (158배 향상) |

### 주요 기능

- ✅ 2단계 처리 패턴 (Cheerio 병렬 → Playwright 재시도)
- ✅ 병렬 처리 (5개씩 동시 처리)
- ✅ 캐싱 레이어 (1시간 TTL)
- ✅ 스트리밍 응답 (NDJSON)
- ✅ Playwright 비활성화 옵션
- ✅ 조기 종료 로직 (5회 연속 실패 후 중단)
- ✅ 8가지 폴백 CSS 선택자
- ✅ 문서 페이지 자동 필터링

---

## 개요

### 목표

외부 Storybook Public URL만으로 디자인 시스템 메타데이터를 추출하여 `ds.json` 생성

### 핵심 원칙

- 사용자의 Storybook 빌드 환경에 접근하지 않음
- Public URL만으로 최대한의 정보 추출
- Addon 설치 없이 동작 (Light 모드)

---

## 데이터 소스

### 1. index.json (핵심)

**URL 패턴**

```
{storybook-url}/index.json
```

**지원 버전**: Storybook 7.x 이상 (storyStoreV7 활성화 필수)

**응답 구조**

```json
{
  "v": 5,
  "entries": {
    "ui-badge--docs": {
      "id": "ui-badge--docs",
      "title": "UI/Badge",
      "name": "Docs",
      "importPath": "../../packages/ui/src/stories/Badge.stories.tsx",
      "type": "docs",
      "tags": ["dev", "test", "autodocs"],
      "storiesImports": []
    },
    "ui-badge--level-solid": {
      "id": "ui-badge--level-solid",
      "title": "UI/Badge",
      "name": "Level Solid",
      "importPath": "../../packages/ui/src/stories/Badge.stories.tsx",
      "type": "story",
      "tags": ["dev", "test"]
    }
  }
}
```

**추출 가능한 정보**

| 필드 | 설명 | 활용 |
|------|------|------|
| `id` | 스토리 고유 ID | iframe URL 생성, 스토리 식별 |
| `title` | 컴포넌트 경로 | 카테고리/컴포넌트 계층 구조 파싱 |
| `name` | 스토리 이름 | variant 식별 (Primary, Secondary 등) |
| `type` | `"docs"` 또는 `"story"` | docs 타입에서 ArgTypes 추출 |
| `tags` | 태그 배열 | autodocs 여부 확인 |
| `importPath` | 원본 파일 경로 | 참고용 (실제 접근 불가) |

**추출 불가능한 정보**

- Props/ArgTypes 정의
- 기본값 (defaultValue)
- Props 타입 (string, boolean, enum 등)
- 컴포넌트 설명 (description)

---

### 2. Docs iframe HTML (Props 추출용)

**URL 패턴**

```
{storybook-url}/iframe.html?id={story-id}&viewMode=docs
```

**예시**

```
https://example.chromatic.com/iframe.html?id=ui-badge--docs&viewMode=docs
```

**ArgTypes 테이블 HTML 구조**

```html
<table class="docblock-argstable">
  <thead>
    <tr>
      <th>Name</th>
      <th>Description</th>
      <th>Default</th>
      <th>Control</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="css-in3yi3">variant</span></td>
      <td>
        <div>배지의 세부 종류를 선택합니다.</div>
        <div>
          <span class="css-o1d7ko">"solid"</span>
          <span class="css-o1d7ko">"subtle"</span>
          <!-- ... -->
        </div>
      </td>
      <td><span>-</span></td>
      <td>
        <select id="control-variant">
          <option value="solid">solid</option>
          <option value="subtle">subtle</option>
          <!-- ... -->
        </select>
      </td>
    </tr>
  </tbody>
</table>
```

**파싱 대상 선택자 (8가지 폴백)**

> 실제 구현: `apps/web/lib/storybook-extractor.ts` SELECTORS 상수

**ArgTypes 테이블 선택자** (Storybook 버전별 호환):
```css
.docblock-argstable,           /* Storybook 7+ 기본 */
[class*="argstable"],          /* 클래스명 변형 */
table[class*="args"],          /* 일반 패턴 */
.sbdocs-argtable,              /* Storybook 6 레거시 */
[data-testid="prop-table"],    /* 테스트 ID 기반 */
table.docblock-table,          /* Docblock 테이블 */
.css-1x2jtvf,                  /* 해시 클래스 (불안정) */
table tbody                    /* 최종 폴백 */
```

**각 필드별 선택자**:

| 데이터 | 선택자 (다중 폴백) |
|--------|-------------------|
| Prop 이름 | `td:first-child span`, `td:first-child code`, `td:first-child button span` |
| 설명 | `td:nth-child(2) > div:first-child` |
| 타입 옵션 | `td:nth-child(2) span[class*="o1d7ko"]`, `td:nth-child(2) code` |
| 기본값 | `td:nth-child(3) span`, `td:nth-child(3) code` |
| Control | `select`, `input[type="text"]`, `input[type="number"]`, `textarea`, `[data-testid]` |
| Select 옵션 | `select option` |

**주의사항**

- CSR(Client-Side Rendering)인 경우 HTML만 fetch하면 빈 테이블 → Playwright로 재시도
- 서버에서 fetch 시 Playwright 필요 (구현 완료)
- CORS 정책에 따라 클라이언트에서 직접 fetch 불가능 → 서버 API 사용

---

### 3. 기타 엔드포인트 (참고용)

| 엔드포인트 | 설명 | 상태 |
|------------|------|------|
| `/stories.json` | Storybook 6.x 호환 | deprecated |
| `/project.json` | 프로젝트 메타데이터 | 제한적 정보 |
| `/stories/{id}.json` | 개별 스토리 상세 | 대부분 404 |

---

## 추출 전략

### Light 모드 (구현 완료)

Public URL만으로 추출, Addon 설치 불필요

```
┌─────────────────────────────────────────────────────────┐
│  1. index.json fetch                                    │
│     → 컴포넌트 목록, 스토리 구조 추출                      │
│                                                         │
│  2. 문서 페이지 필터링                                    │
│     → Welcome, Guides 등 props 없는 페이지 제외           │
│                                                         │
│  3. Cheerio 병렬 처리 (5개씩)                            │
│     → docs iframe HTML fetch + ArgTypes 파싱            │
│                                                         │
│  4. Placeholder 감지 시 Playwright 재시도                │
│     → CSR Storybook 대응                                │
│     → 5회 연속 실패 시 조기 종료                          │
│                                                         │
│  5. 캐싱 (1시간 TTL)                                    │
│                                                         │
│  6. ds.json 생성 및 저장                                 │
│     → /public/ds-schemas/*.ds.json                      │
└─────────────────────────────────────────────────────────┘
```

**API 사용법**:
```bash
# 기본 추출 (Playwright 활성화)
POST /api/ds/extract
Body: { "url": "https://react.carbondesignsystem.com" }

# 고속 추출 (Playwright 비활성화) - 권장
POST /api/ds/extract?playwright=false

# 스트리밍 응답 (진행상황 실시간)
POST /api/ds/extract?stream=true

# 레거시 포맷 출력
POST /api/ds/extract?format=legacy
```

### Full 모드 (향후 확장)

Storybook Addon 설치 필요, 정확한 데이터 추출

```
┌─────────────────────────────────────────────────────────┐
│  1. 사용자가 ds-hub addon 설치                           │
│     → .storybook/main.ts에 addon 추가                   │
│                                                         │
│  2. 빌드 시 storyStore.extract() 실행                   │
│     → 전체 ArgTypes, 기본값, 타입 정보 추출               │
│                                                         │
│  3. ds.json 자동 생성 및 빌드 출력에 포함                  │
└─────────────────────────────────────────────────────────┘
```

---

## 구현 코드

### index.json 파싱

```typescript
interface StoryEntry {
  id: string;
  title: string;
  name: string;
  importPath: string;
  type: 'docs' | 'story';
  tags: string[];
  storiesImports: string[];
}

interface StorybookIndex {
  v: number;
  entries: Record<string, StoryEntry>;
}

interface ComponentInfo {
  category: string;
  name: string;
  stories: string[];
  docsId: string | null;
}

async function fetchStorybookIndex(baseUrl: string): Promise<StorybookIndex> {
  const response = await fetch(`${baseUrl}/index.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch index.json: ${response.status}`);
  }
  return response.json();
}

function parseComponents(entries: Record<string, StoryEntry>): ComponentInfo[] {
  const componentMap = new Map<string, ComponentInfo>();

  for (const entry of Object.values(entries)) {
    // title 파싱: "UI/Badge" → { category: "UI", name: "Badge" }
    const parts = entry.title.split('/');
    const componentName = parts[parts.length - 1];
    const category = parts.slice(0, -1).join('/') || 'Components';
    const key = entry.title;

    if (!componentMap.has(key)) {
      componentMap.set(key, {
        category,
        name: componentName,
        stories: [],
        docsId: null,
      });
    }

    const component = componentMap.get(key)!;

    if (entry.type === 'docs') {
      component.docsId = entry.id;
    } else if (entry.type === 'story') {
      component.stories.push(entry.name);
    }
  }

  return Array.from(componentMap.values());
}
```

### ArgTypes HTML 파싱

```typescript
interface PropInfo {
  name: string;
  description: string | null;
  type: string[];
  defaultValue: string | null;
  control: 'select' | 'number' | 'text' | 'boolean' | 'object' | null;
  options: string[] | null;
}

function parseArgTypesFromHtml(html: string): PropInfo[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const props: PropInfo[] = [];

  const rows = doc.querySelectorAll('.docblock-argstable tbody tr');

  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) continue;

    // Prop 이름
    const nameEl = cells[0].querySelector('span');
    const name = nameEl?.textContent?.trim() || '';

    // 설명
    const descEl = cells[1].querySelector('div:first-child');
    const description = descEl?.textContent?.trim() || null;

    // 타입 (union 값들)
    const typeSpans = cells[1].querySelectorAll('span.css-o1d7ko, span[class*="o1d7ko"]');
    const type = Array.from(typeSpans)
      .map(span => span.textContent?.replace(/"/g, '').trim())
      .filter(Boolean) as string[];

    // 기본값
    const defaultEl = cells[2].querySelector('span');
    const defaultText = defaultEl?.textContent?.trim();
    const defaultValue = defaultText === '-' ? null : defaultText || null;

    // Control 타입 및 옵션
    const select = cells[3].querySelector('select');
    const input = cells[3].querySelector('input');
    
    let control: PropInfo['control'] = null;
    let options: string[] | null = null;

    if (select) {
      control = 'select';
      options = Array.from(select.querySelectorAll('option'))
        .map(opt => opt.value)
        .filter(v => v && v !== 'Choose option...');
    } else if (input) {
      const inputType = input.getAttribute('type');
      control = inputType === 'number' ? 'number' : 'text';
    }

    props.push({ name, description, type, defaultValue, control, options });
  }

  return props;
}
```

### 전체 추출 흐름

```typescript
interface DSComponent {
  name: string;
  category: string;
  stories: string[];
  props: PropInfo[];
}

interface DSJson {
  name: string;
  source: string;
  version: string;
  extractedAt: string;
  components: DSComponent[];
}

async function extractDS(storybookUrl: string): Promise<DSJson> {
  // 1. index.json 추출
  const index = await fetchStorybookIndex(storybookUrl);
  const componentInfos = parseComponents(index.entries);

  // 2. 각 컴포넌트의 props 추출
  const components: DSComponent[] = [];

  for (const info of componentInfos) {
    let props: PropInfo[] = [];

    if (info.docsId) {
      try {
        const docsUrl = `${storybookUrl}/iframe.html?id=${info.docsId}&viewMode=docs`;
        const html = await fetch(docsUrl).then(r => r.text());
        props = parseArgTypesFromHtml(html);
      } catch (error) {
        console.warn(`Failed to extract props for ${info.name}:`, error);
      }
    }

    components.push({
      name: info.name,
      category: info.category,
      stories: info.stories,
      props,
    });
  }

  // 3. ds.json 생성
  return {
    name: extractDSName(storybookUrl),
    source: storybookUrl,
    version: '1.0.0',
    extractedAt: new Date().toISOString(),
    components,
  };
}

function extractDSName(url: string): string {
  // URL에서 DS 이름 추출 시도
  // 예: https://abc123.chromatic.com → "abc123"
  try {
    const hostname = new URL(url).hostname;
    return hostname.split('.')[0] || 'Unknown DS';
  } catch {
    return 'Unknown DS';
  }
}
```

---

## ds.json 스키마

```typescript
interface DSJson {
  /** 디자인 시스템 이름 */
  name: string;
  
  /** 원본 Storybook URL */
  source: string;
  
  /** 스키마 버전 */
  version: string;
  
  /** 추출 일시 (ISO 8601) */
  extractedAt: string;
  
  /** 컴포넌트 목록 */
  components: DSComponent[];
}

interface DSComponent {
  /** 컴포넌트 이름 */
  name: string;
  
  /** 카테고리 (UI, Form, Layout 등) */
  category: string;
  
  /** 스토리 이름 목록 */
  stories: string[];
  
  /** Props 정보 */
  props: PropInfo[];
}

interface PropInfo {
  /** Prop 이름 */
  name: string;
  
  /** 설명 */
  description: string | null;
  
  /** 타입 (union의 경우 배열) */
  type: string[];
  
  /** 기본값 */
  defaultValue: string | null;
  
  /** Control 타입 */
  control: 'select' | 'number' | 'text' | 'boolean' | 'object' | null;
  
  /** select의 경우 옵션 목록 */
  options: string[] | null;
}
```

---

## Storybook Addon 개발 참고

### 공식 문서

- 메인 가이드: https://storybook.js.org/docs/addons
- Addon 작성법: https://storybook.js.org/docs/addons/writing-addons
- API 레퍼런스: https://storybook.js.org/docs/addons/addons-api
- Addon Kit: https://github.com/storybookjs/addon-kit

### 버전별 Breaking Changes

| 버전 | 주요 변경사항 |
|------|--------------|
| 7 → 8 | `@storybook/addons` 패키지 분리 → `preview-api` + `manager-api` |
| 8 → 9 | 패키지 통합 (`storybook` 단일 패키지), import 경로 변경 |
| 9 → 10 | ESM-only 필수화, CJS 지원 완전 제거 |

### import 경로 변화

```typescript
// Storybook 7
import { addons } from '@storybook/addons';

// Storybook 8
import { addons } from '@storybook/preview-api';
import { useStorybookApi } from '@storybook/manager-api';

// Storybook 9+
import { addons } from 'storybook/preview-api';
import { useStorybookApi } from 'storybook/manager-api';
```

### peerDependencies 설정

```json
{
  "peerDependencies": {
    "storybook": "^8.0.0 || ^9.0.0"
  },
  "devDependencies": {
    "storybook": ">=9.0.0-0 <10.0.0-0"
  }
}
```

---

## 제약사항 및 고려사항

### CORS

- 브라우저에서 직접 fetch 시 CORS 차단 가능
- 해결: 서버 사이드에서 fetch 또는 프록시 서버 사용

### CSR 렌더링

- Storybook docs 페이지가 CSR인 경우 HTML만으로 ArgTypes 추출 불가
- 해결: Puppeteer/Playwright로 렌더링 후 파싱

### 버전 호환성

- index.json은 Storybook 7+ 필요 (storyStoreV7)
- 6.x는 stories.json 사용 (구조 다름)

### HTML 구조 변경

- Storybook 버전에 따라 CSS 클래스명 변경 가능
- 파싱 로직에 fallback 선택자 추가 권장

---

## 구현 순서 (완료)

1. ✅ **MVP (Light 모드)** - 완료
   - index.json 파싱으로 컴포넌트 구조 추출
   - 서버 사이드에서 iframe HTML fetch + Cheerio 파싱
   - ds.json 생성 및 `/public/ds-schemas/` 저장

2. ✅ **개선** - 완료
   - Playwright 통합으로 CSR 대응
   - 캐싱 레이어 추가 (1시간 TTL)
   - 병렬 처리 (5개씩 동시 처리)
   - 스트리밍 응답 (NDJSON)
   - 추출 실패 시 graceful degradation
   - Playwright 비활성화 옵션 추가
   - 5회 연속 실패 시 조기 종료

3. 🔲 **Full 모드 (미구현)**
   - Storybook Addon 개발
   - 버전별 패키지 분리 배포
   - 빌드 타임 추출 지원

---

## 테스트용 Storybook URL

```
https://68c8c3461f9760785b557ed9-ablubrqksi.chromatic.com/
```

### 테스트 엔드포인트

```bash
# 컴포넌트 목록
curl https://68c8c3461f9760785b557ed9-ablubrqksi.chromatic.com/index.json

# Badge 컴포넌트 Docs (ArgTypes 포함)
# 브라우저에서 열어서 HTML 확인
https://68c8c3461f9760785b557ed9-ablubrqksi.chromatic.com/iframe.html?id=ui-badge--docs&viewMode=docs

# 개별 스토리 렌더링
https://68c8c3461f9760785b557ed9-ablubrqksi.chromatic.com/iframe.html?id=ui-badge--level-solid&viewMode=story
```

---

## Public Storybook URL 목록

> 다양한 디자인 시스템의 Public Storybook URL을 수집하여 DS-Runtime Hub 테스트에 활용

### 확인된 Public URL

| # | 디자인 시스템 | URL | 호스팅 | 컴포넌트 수 |
|---|--------------|-----|--------|------------|
| 1 | Carbon (IBM) | `https://react.carbondesignsystem.com/` | Custom | 대규모 |
| 2 | Carbon Web Components | `https://web-components.carbondesignsystem.com/` | Custom | - |
| 3 | Primer (GitHub) | `https://primer.style/react/storybook/` | Custom | 80+ |
| 4 | Grafana UI | `https://developers.grafana.com/ui/latest/index.html` | Custom | - |
| 5 | Grommet | `https://storybook.grommet.io/` | Custom | - |
| 6 | BBC Psammead | `https://bbc.github.io/psammead/` | GitHub Pages | 52 |
| 7 | Monday Vibe v3 | `https://vibe.monday.com/` | Custom | 50+ |
| 8 | Monday Vibe v2 | `https://vibe.monday.com/v2/` | Custom | 50+ |
| 9 | Fluent UI (Microsoft) | `https://storybooks.fluentui.dev/react/` | Azure | 대규모 |
| 10 | Workday Canvas | `https://workday.github.io/canvas-kit/` | GitHub Pages | 49 |
| 11 | Wix Design System | `https://www.wix-style-react.com/storybook/` | Custom | 대규모 |
| 12 | Guardian Storybooks | `https://guardian.github.io/storybooks/` | GitHub Pages | - |
| 13 | Mantine (비공식) | `https://spigelli.github.io/mantine-storybook/` | GitHub Pages | - |

### 공식 Storybook이 없는 주요 라이브러리

| 라이브러리 | 상태 | 비고 |
|-----------|------|------|
| **MUI (Material UI)** | ❌ 공식 없음 | `mui.com` 자체 문서 사이트만 운영 |
| **Ant Design** | ❌ 공식 없음 | `ant.design` 자체 문서 사이트 |
| **shadcn/ui** | ❌ 공식 없음 | Copy-paste 방식, Storybook PR 미머지 |
| **Base UI** | ❌ 공식 없음 | MUI에서 분리된 unstyled 라이브러리, 초기 단계 |
| **Radix UI** | ❌ 공식 없음 | Primitives만 제공, 자체 문서 사이트 |
| **Mantine** | ❌ 공식 없음 | `mantine.dev` 자체 문서 사이트 |
| **Chakra UI** | ❌ 공식 없음 | `chakra-ui.com` 자체 문서 사이트 |
| **NextUI** | ❌ 공식 없음 | 자체 문서 사이트 |

> 💡 대형 라이브러리들은 자체 문서 사이트를 선호. Public Storybook을 공개하는 건 주로 **기업 디자인 시스템**(Carbon, Primer, Fluent UI, Vibe 등)이나 중소규모 라이브러리들

### MUI 비공식 Storybook

```javascript
// Storybook Composition용 비공식 프로젝트 (laststance/mui-storybook)
// 완성도 낮음, 일부 컴포넌트만 포함
{
  refs: {
    'mui-storybook': {
      title: "MUI Storybook",
      url: "https://61c23f8c33dad8003adc12f6-cwovkuxnql.chromatic.com/",
    }
  }
}
```

---

## 호스팅 플랫폼별 URL 패턴

### Chromatic

```
# 기본 패턴
https://{branch}--{appid}.chromatic.com/

# 커밋별
https://{commithash}--{appid}.chromatic.com/

# 예시 (MUI 비공식)
https://61c23f8c33dad8003adc12f6-cwovkuxnql.chromatic.com/
```

**특징**
- 무료 호스팅 제공
- Visual Testing 통합
- Storybook Composition 지원

### GitHub Pages

```
# 기본 패턴
https://{org}.github.io/{repo}/

# 예시
https://bbc.github.io/psammead/
https://workday.github.io/canvas-kit/
https://guardian.github.io/storybooks/
```

**특징**
- 무료
- GitHub Actions와 연동 용이
- CORS 제한 없음

### Custom Domain

```
# 예시
https://react.carbondesignsystem.com/
https://primer.style/react/storybook/
https://developers.grafana.com/ui/latest/index.html
https://vibe.monday.com/
https://storybooks.fluentui.dev/react/
```

**특징**
- 대기업/대규모 프로젝트에서 사용
- 브랜딩 일관성
- DNS CNAME 설정 필요

---

## index.json 테스트 명령어

```bash
# Carbon Design System
curl https://react.carbondesignsystem.com/index.json

# Grommet
curl https://storybook.grommet.io/index.json

# Grafana UI
curl https://developers.grafana.com/ui/latest/index.json

# Monday Vibe
curl https://vibe.monday.com/index.json

# Workday Canvas
curl https://workday.github.io/canvas-kit/index.json

# Fluent UI
curl https://storybooks.fluentui.dev/react/index.json
```

---

## 권장 테스트 전략

### 1. Storybook 버전별 테스트

| 버전 | 대상 | 비고 |
|------|------|------|
| Storybook 7 | Carbon, Grommet | storyStoreV7 기본 |
| Storybook 8 | Primer, Grafana, Vibe, Canvas | 최신 안정 버전 |
| Storybook 9+ | Fluent UI (일부) | ESM-only |

### 2. 프레임워크별 테스트

| 프레임워크 | 대상 |
|-----------|------|
| React | 대부분 |
| Web Components | Carbon WC, Fluent UI WC |
| Vue | Grommet (멀티 프레임워크) |

### 3. 컴포넌트 규모별 테스트

| 규모 | 대상 |
|------|------|
| 소규모 (50개 미만) | BBC Psammead, Canvas |
| 중규모 (50-100개) | Vibe, Primer |
| 대규모 (100개 이상) | Carbon, Fluent UI, Wix |

### 4. 호스팅 환경별 테스트

| 환경 | 대상 | CORS |
|------|------|------|
| Chromatic | MUI 비공식 | 허용 |
| GitHub Pages | BBC, Canvas, Guardian | 허용 |
| Custom Domain | Carbon, Primer, Vibe | 확인 필요 |

---

## 참고 자료

### 공식 리소스

- Storybook Showcase: https://storybook.js.org/showcase/
- Chromatic Composition: https://www.chromatic.com/docs/composition/
- Awesome Storybook: https://project-awesome.org/lauthieb/awesome-storybook

### 케이스 스터디

- BBC iPlayer Storybook: https://medium.com/bbc-product-technology/a-storybook-for-bbc-iplayer-web-fbdcd1c201e2
- Guardian "Development Kitchen" 네임스페이스 패턴
- Primer + story.to.design Figma 플러그인 통합

### 관련 도구

- story.to.design: Storybook → Figma 자동 생성
- Chromatic: Visual Testing + 무료 호스팅
- UXPin Merge: Storybook 통합 프로토타이핑

---

## 접근성 및 제약사항

### 공개 → 비공개 전환 사례

| 프로젝트 | 상태 | 비고 |
|---------|------|------|
| Shopify Polaris | 🔒 비공개 | 2025년 기준 Okta 로그인 필요 |
| Atlassian | 🔒 비공개 | Storybook addon만 공개 |

### 일반적인 제약사항

- **CORS**: 클라이언트에서 직접 fetch 시 차단 가능 → 서버 프록시 필요
- **CSR**: HTML만 fetch하면 빈 테이블 → Puppeteer/Playwright 필요
- **버전 호환성**: index.json은 Storybook 7+ 필요 (6.x는 stories.json)
- **HTML 구조 변경**: 버전별 CSS 클래스명 변경 가능 → fallback 선택자 권장
