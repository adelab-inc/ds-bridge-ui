# CLAUDE.md 생성 전략

> DS-Bridge UI 프로젝트의 디렉토리별 CLAUDE.md 관리 전략

## 계층 구조

```
ds-bridge-ui/
├── CLAUDE.md                           # (향후) 모노레포 전체 개요
│
├── apps/
│   ├── web/CLAUDE.md                   # [완료] FE 개발 가이드
│   └── ai-service/CLAUDE.md            # (예정) AI 서비스 가이드
│
├── packages/
│   └── shared-types/CLAUDE.md          # (예정) 공유 스키마 가이드
│
└── Feature별 CLAUDE.md                  # (필요시) 세부 가이드
    ├── components/chat/CLAUDE.md
    ├── components/composition/CLAUDE.md
    └── ...
```

## 레벨별 포함 내용

### Root Level (프로젝트 루트)

| 항목 | 설명 |
|------|------|
| 프로젝트 비전 | DS-Bridge UI 핵심 목표 |
| 아키텍처 | BFF 패턴, 데이터 흐름 |
| 팀 역할 | FE/AI 담당 영역 |
| 공통 규칙 | 커밋 컨벤션, PR 프로세스 |

### App Level (apps/*)

| 항목 | 설명 |
|------|------|
| 기술 스택 | 프레임워크, 라이브러리 버전 |
| 디렉토리 구조 | 폴더별 역할 |
| 코드 컨벤션 | 명명 규칙, 패턴 |
| 개발 명령어 | dev, build, lint |

### Feature Level (components/*, features/*)

| 항목 | 설명 |
|------|------|
| 도메인 로직 | 기능 설명 |
| 데이터 흐름 | 상태 관리 패턴 |
| API 의존성 | 사용하는 API 엔드포인트 |
| 주의사항 | 알려진 이슈, 제한사항 |

## 생성 우선순위 로드맵

### Phase 1: 핵심 앱 (현재)

- [x] `apps/web/CLAUDE.md` - FE 개발 가이드
- [ ] Root `CLAUDE.md` - 모노레포 개요

### Phase 2: 서비스 확장

- [ ] `apps/ai-service/CLAUDE.md` - FastAPI AI 서비스
- [ ] `packages/shared-types/CLAUDE.md` - 공유 스키마

### Phase 3: Feature 세분화

- [ ] `components/chat/CLAUDE.md` - Chat UI
- [ ] `components/composition/CLAUDE.md` - Composition 관리
- [ ] `components/storybook/CLAUDE.md` - Storybook Parser

### Phase 4: 고급 영역

- [ ] `lib/stores/CLAUDE.md` - Zustand 스토어 패턴
- [ ] `app/api/CLAUDE.md` - API 라우트 (BFF)

## 컨텐츠 원칙

### 토큰 효율

```
최적화 전: "이 컴포넌트는 React의 forwardRef를 사용하여 ref를 전달합니다"
최적화 후: "forwardRef 패턴 사용"
```

- 핵심 정보만 포함
- 중복 내용 제거
- 표/리스트 활용

### 스코프 집중

```
apps/web/CLAUDE.md → apps/web/ 내용만
components/chat/CLAUDE.md → Chat 관련만
```

- 해당 디렉토리 범위 한정
- 상위 문서와 중복 최소화

### 참조 활용

```markdown
상세 내용은 [03-tech-stack.md](/docs/specs/03-tech-stack.md) 참조
```

- 심화 내용은 docs/specs 링크
- CLAUDE.md는 요약/진입점 역할

### 실용성

- 즉시 활용 가능한 정보
- 예제 코드 포함
- 명령어 복사 가능

## 업데이트 규칙

### 트리거

| 이벤트 | 액션 |
|--------|------|
| 신규 디렉토리 생성 | CLAUDE.md 필요성 검토 |
| 컨벤션 변경 | 관련 CLAUDE.md 갱신 |
| 기술 스택 변경 | 버전 정보 업데이트 |
| 이슈 발생 | 트러블슈팅 섹션 추가 |

### 버전 관리

```markdown
<!-- 문서 하단 -->
---
최종 업데이트: 2025-01-07
```

## 템플릿

### App Level 템플릿

```markdown
# [앱 이름]

> 한 줄 설명

## 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|

## 디렉토리 구조

## 코드 컨벤션

## 개발 명령어

## 참조 문서

## 현재 상태
```

### Feature Level 템플릿

```markdown
# [기능 이름]

> 한 줄 설명

## 개요

## 데이터 흐름

## 주요 컴포넌트

## API 의존성

## 주의사항
```

---

최종 업데이트: 2025-01-07
