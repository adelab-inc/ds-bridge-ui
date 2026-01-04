# DS-Runtime Hub 프로젝트 요약

## 한 줄 정의

> 디자인 시스템을 실행·조합·코드 복사까지 한 번에 하는 플랫폼

---

## 핵심 흐름

```
Storybook → ds.json → Runtime Hub
```

| 구성 요소 | 역할 |
|-----------|------|
| **Storybook** | 디자인 시스템의 실행 원본 (만드는 쪽) |
| **ds.json** | 공용 스펙으로 변환한 결과 (전달용 프로토콜) |
| **Runtime Hub** | 실행·조합·AI 생성·코드 복사 제공 (쓰는 쪽) |

---

## 왜 만드는가? (서론 핵심)

### AI 시대의 변화
- 디자인 시스템 만드는 비용은 급격히 낮아짐
- 새로운 기준: "이 DS로 AI가 얼마나 일관된 UI를 만들 수 있는가"

### 실력의 새로운 정의
- **디자이너**: 토큰 분리, 컴포넌트 분해, 규칙 명확성 → 시스템 설계력
- **프론트 개발자**: props 구조, variant 예측 가능성 → AI가 안전하게 쓸 수 있는 구현

### 문제
- Figma 링크, Storybook 링크, 문서 설명으로는 "AI가 잘 쓸 수 있는지" 검증 불가

### 해결
- 디자인 시스템을 AI와 사람이 함께 **실행으로 검증**하는 플랫폼

---

## 핵심 화면 구성

```
┌─────────────────────┬─────────────────────┐
│                     │                     │
│  왼쪽               │  오른쪽             │
│  - Chat             │  - Storybook 기반   │
│  - 설정             │    실행 화면        │
│  - Copy 버튼        │                     │
│                     │                     │
└─────────────────────┴─────────────────────┘
```

---

## 두 가지 사용 방식

| 구분 | Storybook URL 바로 쓰기 | npx ds-hub extract |
|------|-------------------------|---------------------|
| 언제 | 처음 써볼 때 / 데모 | 내 DS를 계속 쓸 때 |
| 설치 | ❌ 없음 | ⭕ 필요 |
| 입력 | Storybook URL | 로컬 프로젝트 |
| AI 조합 안정성 | 보통 | 높음 |
| 대상 | 남의 DS | 내 DS |

---

## 워크플로우 3가지

### 1. 그냥 써보는 경우 (30초 와우)
**대상**: 백엔드 개발자, 기획자, 처음 온 사람

1. Storybook URL 붙여넣기
2. 바로 실행 화면 확인
3. 채팅으로 페이지 만들어보기
4. "쓸 만한지" 판단

### 2. 내 DS 제대로 쓰기
**대상**: 디자이너 + 프론트 개발자

1. `npx ds-hub extract` 실행
2. ds.json 생성
3. 플랫폼에 업로드
4. 내 DS 전용 실행 페이지 생성

### 3. 개발자 실제 사용 (Vibe Coding)
**대상**: 백엔드 개발자, 혼자 만드는 사람

1. 공개된 DS 실행
2. 채팅으로 페이지 조합
3. 상태(md, variant 등) 직접 조정
4. `[ Copy for AI ]` 버튼 클릭
5. IDE에 붙여넣고 vibe coding

---

## 플랫폼 포지션

### ❌ 아닌 것
- 디자인 시스템 마켓
- 컴포넌트 스토어
- UI 라이브러리 갤러리
- Dribbble / Behance 같은 보여주기용

### ⭕ 맞는 것
- "Run this Design System" - 실행 기준 공유
- 디자인 시스템을 코드 자산이 아닌 **실행 가능한 레퍼런스**로 만드는 곳

### 공유의 본질
- 다운로드용 공유 ❌
- 실행 기준 공유 ⭕
- 판단(Decision)이 핵심: "우리 상황에 맞는지 빠르게 판단"

---

## 채팅 UI 역할

### ❌ 하면 안 되는 것
- Lovable식 자유 생성 채팅
- AI가 추측하거나 임의 조합

### ⭕ 해야 하는 것
- ds.json을 읽어서 선택지를 안내하는 **가이드형 채팅**
- "디자인 시스템을 걸어다니게 만드는 네비게이터"

### 단계별 역할

| 단계 | 채팅의 역할 |
|------|-------------|
| 1막 | 안내자 / 탐색 도우미 |
| 2막 | 편집 보조자 |
| 3막 | 조합 제안자 |
| 4막 | 온보딩 가이드 |
| 5막 | 확장 탐색자 |

---

## 공개 페이지 전략

### 초기 전략
- 기본은 **Private / Team-first**
- Public은 옵션 (명시적 선택)

### 공개의 목적
- "보여주기" ❌
- "판단을 위임하기 위한 공개" ⭕
- 첫 액션은 항상 `[ Run this Design System ]`

---

## 대시보드 등 복잡한 UI 지원

### 접근 방식
- 말로 "이게 좋은 대시보드입니다" ❌
- 실행 가능한 예시를 즉시 보여주기 ⭕

### 동작 방식
1. AI가 "자주 쓰이는 구조"를 실행해서 보여줌
2. 사용자가 실행하면서 판단
3. props 만져보고, 차트 바꿔보고, 필터 위치 조정
4. "여기서 이 부분만 바꾸면 되겠다" 결정

---

## Vibe Coding 연결 구조

### 3개의 축

| 축 | 역할 |
|----|------|
| **Figma** | 의도(Design Intent) / 토큰의 원천 |
| **Storybook** | 구현(Implementation) / 실행 결과 |
| **DS Hub** | 인덱스 + 묶음 + Export |

### 토큰 파이프라인
- **1순위**: Figma Tokens → Export 파일 (의도 유지)
- **2순위**: Storybook 런타임 Computed Styles 추출 (현실 타협)

### Copy for AI 출력 형태

```
We use Acme Design System.

TOKENS (use these exact values)
- Primary color: #0052cc
- Spacing: 4/8/16/24 px
- Radius: 4/6/10 px
- Font: Inter

CONFIRMED COMPOSITION (already reviewed)
- FilterBar (sticky: true)
- MetricCard x3
- LineChart (variant: primary)
- DataTable (dense: true)
- Pagination

Generate a React page using existing DS components.
Use the tokens above for spacing and colors.
```

---

## 경쟁 환경 분석

| 서비스 | 하는 것 | 못하는 것 |
|--------|---------|-----------|
| **Storybook/Chromatic** | 컴포넌트 실행, 상태 확인 | 페이지 조합, AI 생성, 바로 가져다 쓰기 |
| **Figma + Dev Mode** | 디자인 → 코드 힌트 | 실제 실행, Storybook 연동, AI 조합 |
| **v0/Lovable/Uizard** | 텍스트 → UI 생성 | **기존 DS 기반 생성**, 팀 규칙 보존 |
| **Backlight/Zeroheight** | DS 문서화 | 실행 중심 UX, AI 조합, vibe coding 연계 |

### DS-Runtime Hub의 차별점

> Storybook + JSON + 실행 + AI 조합 + 바로 코드로 가져가기
> 이 흐름을 **하나의 런타임**으로 묶은 서비스는 아직 없다.

---

## 핵심 키워드 정리

- **URL** = 빠르게 판단
- **extract** = 제대로 사용
- **채팅** = 조합과 결정
- **Copy for AI** = 바로 구현
- **실행** = 모든 것의 기준
