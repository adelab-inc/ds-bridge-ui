# Description API 명세 (BE → FE 전달용)

> **Base URL**: `{AI_SERVER_URL}/description`
> **인증**: `X-API-Key` 헤더 (BFF 경유 시 Supabase JWT → BFF → X-API-Key)

---

## 1. 디스크립션 추출 (AI 생성)

### `POST /description/extract`

대화 히스토리 + 코드 + 편집 이력을 종합하여 AI가 디스크립션을 생성합니다.

**Request Body**:
```json
{
  "room_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `room_id` | string (UUID) | ✅ | 채팅방 ID |

> 코드, 대화 히스토리, 편집 이력은 모두 서버에서 DB 조회하여 자동으로 가져옵니다.

**Response (200)**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "version": 2,
  "content": "## 화면 개요\n\n### ■ 화면명\n- Dashboard\n\n...",
  "reason": "regenerated_with_edits"
}
```

**reason 값**:

| 값 | 조건 |
|----|------|
| `initial` | 최초 추출 (이전 버전 없음) |
| `regenerated_with_edits` | 재추출 + 편집 이력 있음 |
| `regenerated` | 재추출 + 편집 이력 없음 |

**에러 응답**:

| 코드 | 조건 |
|------|------|
| 404 | 채팅방 미존재 또는 생성된 코드 없음 |
| 422 | 대화 히스토리 0건 |
| 500 | LLM 호출 실패 / DB 오류 |

---

## 2. 최신 디스크립션 조회

### `GET /description/{room_id}`

해당 채팅방의 최신 버전 디스크립션을 조회합니다.

**Response (200)**:
```json
{
  "id": "a1b2c3d4-...",
  "room_id": "550e8400-...",
  "content": "## 화면 개요\n...",
  "version": 2,
  "reason": "regenerated_with_edits",
  "edited_content": "사용자가 수정한 텍스트 (null이면 편집 안 함)",
  "created_at": 1709568000000
}
```

| 필드 | 설명 |
|------|------|
| `content` | AI 원본 디스크립션 |
| `edited_content` | 사용자 편집본 (`null`이면 편집 없음). **읽기 전용 뷰에서는 `edited_content ?? content` 표시** |

**에러**: 404 (디스크립션 미존재)

---

## 3. 편집 이력 저장

### `PUT /description/{room_id}/edit`

최신 버전의 `edited_content`를 업데이트합니다. (사용자가 [저장 후 닫기] 클릭 시 호출)

**Request Body**:
```json
{
  "edited_content": "사용자가 수정한 디스크립션 텍스트"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `edited_content` | string | ✅ | 편집한 텍스트 (최소 1자) |

**Response (200)**:
```json
{
  "id": "a1b2c3d4-...",
  "version": 1,
  "edited_content": "사용자가 수정한 디스크립션 텍스트"
}
```

**에러**: 404 (디스크립션 미존재)

---

## 4. 버전 목록 조회

### `GET /description/{room_id}/versions`

해당 채팅방의 모든 디스크립션 버전을 최신순으로 조회합니다. (생성 이력 패널용)

**Response (200)**:
```json
{
  "versions": [
    {
      "id": "a1b2...",
      "version": 2,
      "reason": "regenerated_with_edits",
      "created_at": 1709568000000
    },
    {
      "id": "1122...",
      "version": 1,
      "reason": "initial",
      "created_at": 1709500000000
    }
  ]
}
```

---

## 5. 특정 버전 조회

### `GET /description/{room_id}/versions/{id}`

특정 버전의 디스크립션 전체 내용을 조회합니다. (이력 패널에서 이전 버전 미리보기용)

**Path Parameters**:

| 파라미터 | 설명 |
|----------|------|
| `room_id` | 채팅방 ID |
| `id` | 디스크립션 ID (UUID, 버전 목록에서 받은 `id` 값) |

**Response (200)**: `GET /description/{room_id}`와 동일한 형식

**에러**: 404 (해당 버전 미존재)

---

## 6. DB 스키마 (`descriptions` 테이블)

```sql
CREATE TABLE descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('initial', 'regenerated_with_edits', 'regenerated')),
  edited_content TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE (room_id, version)
);

CREATE INDEX idx_descriptions_room_version ON descriptions(room_id, version DESC);
```

> Supabase Dashboard → SQL Editor에서 실행 필요

---

## 7. TypeScript 타입 (`packages/shared-types`)

`packages/shared-types/typescript/database/types.ts`에 아래 타입이 추가되어 있습니다:

```typescript
export type DescriptionReason = 'initial' | 'regenerated_with_edits' | 'regenerated';

export interface Description {
  id: string;
  room_id: string;
  content: string;
  version: number;
  reason: DescriptionReason;
  edited_content: string | null;
  created_at: number;
}

export interface DescriptionVersionSummary {
  id: string;
  version: number;
  reason: DescriptionReason;
  created_at: number;
}

export interface EditHistory {
  original_content: string;
  edited_content: string;
  base_version: number;
}
```

---

## 8. FE 연동 시 참고사항

### BFF 라우트 필요

기존 패턴(`apps/web/app/api/chat/stream/route.ts`)처럼 BFF 라우트를 만들어야 합니다:

| BFF Path | FastAPI Path |
|----------|-------------|
| `POST /api/description/extract` | `POST /description/extract` |
| `GET /api/description/[room_id]` | `GET /description/{room_id}` |
| `PUT /api/description/[room_id]/edit` | `PUT /description/{room_id}/edit` |
| `GET /api/description/[room_id]/versions` | `GET /description/{room_id}/versions` |
| `GET /api/description/[room_id]/versions/[id]` | `GET /description/{room_id}/versions/{id}` |

### 편집 이력 자동 병합 로직

1. 사용자가 디스크립션 편집 → [저장 후 닫기] → `PUT /description/{room_id}/edit` 호출
2. 추가 대화 진행 후 [디스크립션 추출] 재클릭
3. `POST /description/extract`에 `room_id`만 보내면 BE가 DB에서 편집 이력(`edited_content`)을 자동 감지하여 AI 컨텍스트에 포함

### 뷰 표시 로직

```
표시할 내용 = edited_content ?? content
```

- `edited_content`가 있으면 사용자 수정본 표시
- `null`이면 AI 원본 표시
