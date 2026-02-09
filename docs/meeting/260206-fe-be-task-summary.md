# 기획 프로세스 개선 회의 - FE / BE Task 정리

> 회의 일시: 2026-02-06
> 회의 주제: 기획 프로세스 개선 및 AI 도구 도입
> 참석자: 곽상무님, 영빈, 철승, 희원, 정훈 외

---

## 현재 구현 현황 요약

| 기능                                       | 상태          | 비고                                           |
| ------------------------------------------ | ------------- | ---------------------------------------------- |
| AI 채팅 + 코드 생성 (SSE 스트리밍)         | 완료          | OpenAI/Anthropic/Gemini 멀티 프로바이더        |
| 이미지 업로드 + Vision 기반 코드 생성      | 완료          | 클립보드 붙여넣기, 파일 업로드                 |
| 디자인 시스템 컴포넌트 17개 화이트리스트   | 완료          | Button, DataGrid, Badge 등                     |
| 디자인 토큰 (색상, 타이포, 스페이싱)       | 완료          | Firebase Storage 기반 동적 로딩                |
| Room 기반 대화 관리 + URL 공유 (`?crid=`)  | 완료          | Firestore 영속화                               |
| 대화 이력 + 페이지네이션                   | 완료          | 무한 스크롤                                    |
| 기존 코드 기반 수정 (`from_message_id`)    | 완료          | 베이스 코드 편집 모드                          |
| 프리뷰 (AI 생성 / Storybook / Composition) | 완료          | iframe 기반                                    |
| 반응형 레이아웃 (Desktop/Mobile)           | 완료          | resizable panels                               |
| 1920 해상도 지원                           | **미완료**    | 현재 제한적                                    |
| 피그마 색상 팔레트 추출                    | **부분 구현** | `/api/figma/extract` 존재, 색상 토큰 매핑 미완 |
| 컴포넌트 일괄 업데이트 (배치)              | **미구현**    |                                                |
| 디자인 룰 자동 적용 (정렬, 간격)           | **부분 구현** | 프롬프트에 일부 규칙 존재                      |

---

## FE Tasks (Frontend)

### FE-1. 1920px 해상도 대응

- **우선순위:** 높음 (다음 주 목표)
- **현재 상태:** 레이아웃은 반응형이나 AI 생성 프리뷰가 1920 기준이 아님
- **할 일:**
  - [ ] 프리뷰 iframe 뷰포트를 1920px 기준으로 렌더링하도록 수정
  - [ ] 프리뷰 영역에 해상도 선택 옵션 추가 (1280 / 1440 / 1920)
  - [ ] AI 생성 코드의 컨테이너 `maxWidth` 조정
- **관련 파일:**
  - `apps/web/components/features/preview/preview-section.tsx`
  - `apps/web/components/features/preview/code-preview-iframe.tsx`
  - `apps/web/lib/constants.ts`

---

### FE-2. 페이지별 URL 관리 및 공유 기능 강화

- **우선순위:** 중간 (회의에서 "페이지마다 링크가 별개" 언급)
- **현재 상태:** `?crid=` 쿼리 파라미터로 Room 공유 가능
- **할 일:**
  - [ ] URL 복사 시 현재 선택된 메시지(생성 결과)까지 포함하도록 확장 (예: `?crid=xxx&mid=yyy`)
  - [ ] 공유 URL 접속 시 해당 메시지의 생성 코드를 바로 프리뷰에 표시
  - [ ] 기획 페이지에 링크 목록 관리 UI 추가 (북마크/라벨링)
- **관련 파일:**
  - `apps/web/hooks/useRoom.ts`
  - `apps/web/components/features/preview/preview-section.tsx`
  - `apps/web/components/features/chat/chat-section.tsx`

---

### FE-3. 코드 복사/내보내기 기능 개선

- **우선순위:** 높음 (프로토타입 코드를 프론트 개발자에게 전달하는 핵심 플로우)
- **현재 상태:** ActionsSection에 기본 복사 기능 존재
- **할 일:**
  - [ ] "코드 복사" 버튼에 포맷 옵션 추가 (Raw TSX / Import 포함 전체 파일)
  - [ ] 생성된 코드 다운로드 기능 (`.tsx` 파일로 저장)
  - [ ] 복사 시 사용된 컴포넌트 import 구문 자동 포함
- **관련 파일:**
  - `apps/web/components/features/actions/actions-section.tsx`
  - `apps/web/stores/useCodeGenerationStore.ts`

---

### FE-4. 디자인 토큰 색상 팔레트 시각화

- **우선순위:** 중간 (희원님 피드백 - 색상 지정 관련)
- **현재 상태:** 디자인 토큰이 Firebase에 저장되어 있으나 UI에서 조회 불가
- **할 일:**
  - [ ] 좌측 패널에 "디자인 토큰" 탭 추가 (컴포넌트 목록과 병렬)
  - [ ] 색상 팔레트 뷰어 (토큰명 + 색상 프리뷰 + 값 복사)
  - [ ] 채팅 입력 시 토큰명 자동완성 지원 (선택적)
- **관련 파일:**
  - `apps/web/components/features/component-list/component-list-section.tsx`
  - `apps/web/components/layout/left-panel.tsx`
  - `storybook-standalone/packages/ui/src/design-tokens/color.json`

---

### FE-5. AI 생성 이력 관리 UI 개선

- **우선순위:** 중간 (회의에서 "이전 기록도 보실 수 있다" 언급)
- **현재 상태:** 채팅 이력은 Firestore에 저장, 무한 스크롤로 조회 가능
- **할 일:**
  - [ ] 메시지 목록에서 특정 생성 결과 클릭 시 프리뷰 전환
  - [ ] 생성 결과 간 비교 뷰 (이전 vs 현재)
  - [ ] 대화 이력 검색 기능
- **관련 파일:**
  - `apps/web/components/features/chat/chat-message-list.tsx`
  - `apps/web/components/features/chat/chat-message.tsx`
  - `apps/web/hooks/firebase/useGetPaginatedFbMessages.ts`

---

## BE Tasks (Backend - AI Service)

### BE-1. 디자인 룰 시스템 프롬프트 강화

- **우선순위:** 높음 (회의 핵심 - 정렬/간격/그리드 정책 자동 적용)
- **현재 상태:** `SYSTEM_PROMPT_FOOTER`에 일부 규칙 존재 (컨테이너, 반응형, status badge 등)
- **할 일:**
  - [ ] 그리드 정렬 규칙 추가: 텍스트=좌측 정렬, 숫자=우측 정렬, 상태=중앙 정렬
  - [ ] 간격 표준화 규칙: 섹션 간 gap, 카드 내부 padding 등 디자인 토큰 기반
  - [ ] DataGrid 컬럼 정렬 기본값 규칙 (타입별 자동 정렬)
  - [ ] 뱃지/태그 색상 규칙: 상태별 시맨틱 컬러 매핑 (토큰명 기반)
  - [ ] 디자인 룰을 별도 설정 파일로 분리하여 관리 가능하게 구조화
- **관련 파일:**
  - `apps/ai-service/app/api/components.py` (프롬프트 생성)
  - `apps/ai-service/component-schema.json`

---

### BE-2. 피그마 색상 팔레트 추출 및 토큰 매핑

- **우선순위:** 높음
- **현재 상태:** `/api/figma/extract` 엔드포인트 존재, 색상 토큰과의 연동 미완성
- **할 일:**
  - [ ] 피그마 API 연동으로 색상 스타일/토큰 추출
  - [ ] 추출된 색상을 기존 디자인 토큰 포맷(`design-tokens.json`)에 매핑
  - [ ] 매핑 결과를 Firebase Storage에 업데이트
  - [ ] 토큰명으로 AI에 지시 시 정확한 색상값 적용 검증
- **관련 파일:**
  - `apps/web/app/api/figma/extract/route.ts`
  - `apps/web/lib/figma/`
  - `apps/ai-service/app/services/firebase_storage.py`

---

### BE-3. 컴포넌트 스키마 일괄 업데이트 (배치 처리)

- **우선순위:** 중간 (회의에서 "배치로 돌려서 일괄 업데이트" 언급)
- **현재 상태:** 스키마 로딩은 지원하나 기존 생성물 일괄 재생성은 미구현
- **할 일:**
  - [ ] 디자인 시스템 버전 관리 스키마 추가 (version 필드)
  - [ ] 스키마 업데이트 시 기존 Room의 생성물 일괄 재생성 API
  - [ ] 배치 작업 상태 조회 API (진행률, 완료/실패 건수)
- **관련 파일:**
  - `apps/ai-service/app/api/components.py`
  - `apps/ai-service/app/services/firebase_storage.py`
  - `apps/ai-service/app/services/firestore.py`

---

### BE-4. 1920px 해상도 기준 코드 생성 최적화

- **우선순위:** 높음
- **현재 상태:** 프롬프트에 반응형 규칙 존재하나 1920 기준 최적화 미흡
- **할 일:**
  - [ ] 시스템 프롬프트에 1920px 기준 레이아웃 규칙 추가
  - [ ] 채팅 요청에 `target_resolution` 파라미터 추가 (기본값 1920)
  - [ ] 해상도별 그리드 컬럼 수, 최대 너비 등 동적 조정
- **관련 파일:**
  - `apps/ai-service/app/api/chat.py`
  - `apps/ai-service/app/api/components.py`
  - `apps/ai-service/app/schemas/chat.py`

---

### BE-5. AI 프롬프트 품질 개선 (디자이너 피드백 반영 체계)

- **우선순위:** 중간 (2주 테스트 기간 중 지속 개선)
- **현재 상태:** 프롬프트에 기본 규칙 존재
- **할 일:**
  - [ ] 디자인 규칙 피드백을 수집하여 프롬프트에 반영하는 파이프라인 구축
  - [ ] 규칙 카테고리화: 정렬, 간격, 색상, 타이포그래피, 컴포넌트 사용법
  - [ ] 규칙별 on/off 토글 가능한 설정 관리 (Firebase 또는 설정 파일)
  - [ ] few-shot 예시 추가 (잘 된 생성 결과를 레퍼런스로 등록)
- **관련 파일:**
  - `apps/ai-service/app/api/components.py`
  - `apps/ai-service/app/services/firebase_storage.py`

---

## 우선순위 요약

### 즉시 (다음 주)

| ID   | 구분 | 내용                                            |
| ---- | ---- | ----------------------------------------------- |
| FE-1 | FE   | 1920px 해상도 대응                              |
| BE-4 | BE   | 1920px 기준 코드 생성 최적화                    |
| BE-1 | BE   | 디자인 룰 시스템 프롬프트 강화 (정렬/간격/색상) |
| BE-2 | BE   | 피그마 색상 팔레트 추출 및 토큰 매핑            |

### 2주 테스트 기간 중

| ID   | 구분 | 내용                                         |
| ---- | ---- | -------------------------------------------- |
| FE-3 | FE   | 코드 복사/내보내기 기능 개선                 |
| FE-2 | FE   | 페이지별 URL 관리 및 공유 기능 강화          |
| BE-5 | BE   | AI 프롬프트 품질 개선 (디자이너 피드백 반영) |

### 중기 (테스트 기간 이후)

| ID   | 구분 | 내용                                      |
| ---- | ---- | ----------------------------------------- |
| FE-4 | FE   | 디자인 토큰 색상 팔레트 시각화            |
| FE-5 | FE   | AI 생성 이력 관리 UI 개선                 |
| BE-3 | BE   | 컴포넌트 스키마 일괄 업데이트 (배치 처리) |

---

## 회의 Action Item ↔ Task 매핑

| Action Item                             | 관련 Task                 |
| --------------------------------------- | ------------------------- |
| #4 - 1920 해상도 패치                   | FE-1, BE-4                |
| #5 - 피그마 색상 팔레트 추출            | BE-2, FE-4                |
| #6 - AI 도구 기능 QA 채널               | BE-5 (피드백 파이프라인)  |
| #9 - AI 생성 화면 디자인 품질 평가 기준 | BE-1 (디자인 룰)          |
| 프로토타입 코드 전달 방식               | FE-3 (코드 복사/내보내기) |
| 페이지별 URL 관리                       | FE-2 (URL 공유 강화)      |
| 컴포넌트 일괄 업데이트                  | BE-3 (배치 처리)          |
