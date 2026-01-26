# DS-Bridge UI 개발 회의 아젠다

> **기간**: 2026-01-13 ~ 2026-01-19 (PR #10 ~ #14)
> **참석자**: JaeHyeon-Cho, DevJunghun, JAM-PARK

---

## 📋 아젠다 개요

| 순서 | 주제 | 담당자 | 예상 시간 |
|------|------|--------|----------|
| 1 | API 스펙 업데이트 및 채팅 구조 변경 | JaeHyeon-Cho | 10분 |
| 2 | AI 서비스 개선 및 타입 시스템 통합 | DevJunghun | 10분 |
| 3 | 개발 환경 개선 및 문서화 | JAM-PARK | 5분 |
| 4 | AI 코드 프리뷰 핵심 기능 | JAM-PARK | 15분 |
| 5 | 시스템 프롬프트 범용화 계획 | JAM-PARK | 10분 |
| 6 | 논의 사항 및 다음 단계 | 전체 | 10분 |

---

## 1️⃣ API 스펙 업데이트 및 채팅 구조 변경

**PR #10** | JaeHyeon-Cho | 2026-01-13 | `+1,373 / -375` (31 files)

### 주요 변경 사항

#### 1.1 ChatMessage 타입 구조 변경
```
기존: 질문과 답변이 별도 메시지
변경: 질문/답변이 하나의 메시지에 존재
```

**변경된 타입 구조**:
```typescript
interface ChatMessage {
  id: string;
  room_id: string;
  question: string;           // 사용자 질문
  text: string;               // AI 텍스트 응답
  content: string;            // React 코드
  path: string;               // 파일 경로
  question_created_at: number;
  answer_created_at: number;
  status: 'GENERATING' | 'DONE' | 'ERROR';
}
```

#### 1.2 API 라우트 재구성
```
/api/chat/*           → /api/rooms/[room_id]/*
```

**새로운 엔드포인트**:
- `GET /api/rooms` - 채팅방 목록
- `POST /api/rooms` - 채팅방 생성
- `GET /api/rooms/[room_id]` - 채팅방 조회

#### 1.3 useRoom 훅 추가
- URL 쿼리 파라미터(`crid`)로 채팅방 관리
- 자동 채팅방 생성/조회 로직
- `RoomProvider` 컨텍스트 추가

#### 1.4 chat-section 클로저 문제 해결
```
useState → useRef 변경으로 클로저 이슈 해결
```

### 💬 논의 포인트
- [ ] 메시지 타입 통합이 프론트/백엔드 간 동기화 잘 되었는지?
- [ ] rooms 기반 API 구조가 확장성 측면에서 적절한지?

---

## 2️⃣ AI 서비스 개선 및 타입 시스템 통합

**PR #11** | DevJunghun | 2026-01-14 | `+497 / -190` (14 files)

### 주요 변경 사항

#### 2.1 Firestore 비동기 클라이언트 적용
```python
# 기존: 동기 클라이언트
# 변경: 비동기 클라이언트로 성능 개선
```

#### 2.2 시스템 프롬프트 개선
- React 베스트 프랙티스 가이드라인 추가
- AI 코드 생성 품질 향상 목적

#### 2.3 보안 취약점 개선
- 코드 리뷰 사항 반영
- 인증/권한 관련 개선

### 변경된 파일 (주요)
```
apps/ai-service/
├── app/api/chat.py
├── app/api/components.py
├── app/api/rooms.py
├── app/core/auth.py
├── app/services/ai_provider.py
├── app/services/firebase_storage.py
└── app/services/firestore.py
```

### 💬 논의 포인트
- [ ] 비동기 전환 후 성능 측정 결과?
- [ ] 보안 취약점 상세 내용 공유

---

## 3️⃣ 개발 환경 개선 및 문서화

**PR #12** | JAM-PARK | 2026-01-15 | `+1,404 / -207` (6 files)

### 주요 변경 사항

#### 3.1 Base UI Hydration 에러 수정
- React 19 `useId()` 훅으로 인한 SSR/클라이언트 ID 불일치 해결
- `ClientOnly` 래퍼 패턴 도입

**해결 패턴**:
```tsx
<ClientOnly fallback={<Skeleton />}>
  <BaseUIComponent />
</ClientOnly>
```

#### 3.2 RSC 가이드라인 문서화
- Server/Client 컴포넌트 분리 기준 명확화
- CLAUDE.md에 가이드라인 추가

#### 3.3 Firebase/Firestore 문서화
- 컬렉션 구조, 타입, 훅 사용법 문서화

#### 3.4 개발 서버 포트 변경
```bash
# 기존: localhost:3000
# 변경: localhost:5555
```

### 💬 논의 포인트
- [ ] 포트 변경 이유 및 다른 서비스와 충돌 여부?

---

## 4️⃣ AI 코드 프리뷰 핵심 기능 ⭐

**PR #13** | JAM-PARK | 2026-01-18 | `+2,437 / -20` (21 files)

### 주요 변경 사항

#### 4.1 @aplus/ui UMD 번들 빌드 설정
```bash
# esbuild 기반 UMD 번들 + Tailwind CSS
pnpm build:umd
```

**API 엔드포인트**:
- `/api/ui-bundle` - UMD JavaScript 번들
- `/api/ui-bundle/css` - CSS 스타일

#### 4.2 CodePreviewIframe 컴포넌트 (핵심)
```
AI 생성 코드 → Sucrase 트랜스파일 → iframe 렌더링
```

**동작 흐름**:
1. AI가 생성한 React 코드 수신
2. import 문 파싱 → 사용 컴포넌트 추출
3. Sucrase로 JSX/TypeScript 트랜스파일
4. `window.AplusUI`에서 컴포넌트 매핑
5. iframe 내 React 18 `createRoot`로 렌더링

**핵심 코드 위치**: `apps/web/components/features/preview/code-preview-iframe.tsx`

#### 4.3 Zustand 스토어로 상태 동기화
```typescript
// stores/useCodeGenerationStore.ts
interface CodeGenerationState {
  generatedCode: CodeEvent | null;
  isGeneratingCode: boolean;
  onStreamStart: () => void;
  onStreamEnd: () => void;
  onCodeGenerated: (code: CodeEvent) => void;
}
```

**해결한 문제**: Desktop/Mobile 뷰포트 전환 시 AI 생성 코드 상태 유지

#### 4.4 PreviewSection 탭 통합
```
Storybook 탭 | AI Code 탭
```

#### 4.5 모바일 채팅 500 에러 수정
- MobileLayout에 `useRoom` 훅 통합
- 빈 `roomId` 하드코딩 제거
- Suspense boundary 추가

### 아키텍처 다이어그램
```
┌─────────────────────────────────────────────────────────┐
│                    ChatSection                          │
│  ┌─────────────────┐    ┌───────────────────────────┐  │
│  │ useChatStream   │───▶│ useCodeGenerationStore    │  │
│  │ (AI 응답 수신)  │    │ (Zustand 전역 상태)       │  │
│  └─────────────────┘    └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   PreviewSection                        │
│  ┌─────────────────┐    ┌───────────────────────────┐  │
│  │ Storybook Tab   │    │ AI Code Tab               │  │
│  │ (기존 iframe)   │    │ (CodePreviewIframe)       │  │
│  └─────────────────┘    └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 💬 논의 포인트
- [ ] iframe sandbox 보안 설정 충분한지?
- [ ] UMD 번들 크기 최적화 필요성?
- [ ] 컴포넌트 누락 시 fallback UI 적절한지?

---

## 5️⃣ 시스템 프롬프트 범용화 계획

**PR #14** | JAM-PARK | 2026-01-19 | `+470 / -120` (5 files)

### 주요 변경 사항

#### 5.1 시스템 프롬프트 범용화 계획 문서
**문제점**:
```python
# 현재: @aplus/ui에 하드코딩된 규칙
SYSTEM_PROMPT_FOOTER = """
❌ color="green" → ✅ variant="success-solid"  # @aplus/ui 특화
"""
```

**해결 방안**: 스키마 확장 + 프롬프트 동적 생성

#### 5.2 스키마 확장 구조 (계획)
```json
{
  "components": {
    "Badge": {
      "props": { ... },
      "usageRules": [
        {
          "condition": "type=\"status\"",
          "requires": ["statusVariant"],
          "note": "status 타입 사용 시 statusVariant 필수"
        }
      ],
      "examples": {
        "correct": "<Badge variant=\"success-solid\" type=\"status\" statusVariant=\"success\">추천</Badge>",
        "incorrect": "<Badge variant=\"success-solid\" type=\"status\">추천</Badge>"
      }
    }
  }
}
```

#### 5.3 구현 Phase
| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | 스키마 확장 (오버라이드 파일) | 계획 |
| Phase 2 | 프롬프트 동적화 | 계획 |
| Phase 3 | 문서 정리 | 계획 |

#### 5.4 문서 정리
- `ai-component-usage-guide.md` → `aplus-ui-props-guide.md` 파일명 변경
- Heading 컴포넌트 re-export 추가

### 💬 논의 포인트
- [ ] 범용화 우선순위 및 일정?
- [ ] 다른 디자인 시스템(MUI, Chakra 등) 지원 계획?

---

## 6️⃣ 전체 논의 사항

### 📊 PR 통계 요약

| PR | 작성자 | 추가 | 삭제 | 파일 수 | 주요 키워드 |
|----|--------|------|------|---------|-------------|
| #10 | JaeHyeon-Cho | +1,373 | -375 | 31 | API 구조, 타입, useRoom |
| #11 | DevJunghun | +497 | -190 | 14 | 비동기, 보안, 프롬프트 |
| #12 | JAM-PARK | +1,404 | -207 | 6 | Hydration, RSC, 문서화 |
| #13 | JAM-PARK | +2,437 | -20 | 21 | UMD, iframe, Zustand |
| #14 | JAM-PARK | +470 | -120 | 5 | 범용화 계획, 문서 정리 |
| **총계** | | **+6,181** | **-912** | **77** | |

### 🔗 기술 스택 변경 사항
- **Zustand** 추가 (전역 상태 관리)
- **esbuild** 추가 (UMD 번들 빌드)
- **Sucrase** 추가 (JSX 트랜스파일)

### ⚠️ 알려진 이슈
1. AI 생성 코드에서 일부 컴포넌트(Badge, Chip) 렌더링 문제 → Props 가이드 문서화로 대응
2. Base UI hydration 에러 → ClientOnly 래퍼로 해결

### 🎯 다음 단계 논의
- [ ] 시스템 프롬프트 범용화 구현 착수 시점?
- [ ] 테스트 커버리지 계획?
- [ ] 성능 모니터링 방안?

---

## 📎 참고 자료

### 문서 위치
| 문서 | 경로 | 설명 |
|------|------|------|
| AI 코드 프리뷰 구현 | `docs/web/ai-code-preview-implementation.md` | CodePreviewIframe 동작 원리 |
| AI 코드 프리뷰 디버깅 | `docs/web/ai-code-preview-debugging.md` | 디버깅 가이드 |
| @aplus/ui Props 가이드 | `docs/web/aplus-ui-props-guide.md` | AI 컴포넌트 사용 규칙 |
| 범용화 계획 | `docs/web/system-prompt-generalization-plan.md` | 시스템 프롬프트 개선 계획 |

### PR 링크
- [PR #10](https://github.com/adelab-inc/ds-bridge-ui/pull/10) - API 스펙 업데이트
- [PR #11](https://github.com/adelab-inc/ds-bridge-ui/pull/11) - AI 서비스 개선
- [PR #12](https://github.com/adelab-inc/ds-bridge-ui/pull/12) - 개발 환경 개선
- [PR #13](https://github.com/adelab-inc/ds-bridge-ui/pull/13) - AI 코드 프리뷰
- [PR #14](https://github.com/adelab-inc/ds-bridge-ui/pull/14) - 문서 정리
