# 채팅 로직 설계 (Supabase 기반)

## 개요

Supabase Broadcast + Postgres를 활용한 채팅 메시지 관리 로직.
스트리밍은 Broadcast, 영속성은 Postgres, 메시지 조회는 fetch 기반.

---

## 데이터 흐름 요약

```
방 입장 → DB에서 최근 20개 메시지 fetch → state 세팅
질문 전송 → HTTP POST (트리거) → 서버가 Broadcast로 답변 중계
스트리밍 중 → Broadcast chunk 수신 → 로컬 state 업데이트
스트리밍 완료 → 서버가 DB INSERT → 클라이언트가 DB fetch로 동기화
새로고침 → DB에서 다시 fetch (저장된 메시지 포함)
```

---

## 상세 플로우

### 1. 방 입장

```
유저가 Room 페이지 진입
    │
    ├─ 1) Supabase에서 최근 20개 메시지 fetch
    │     select * from chat_messages
    │     where room_id = :roomId
    │     order by question_created_at desc
    │     limit 20
    │     → reverse 후 messages state 세팅
    │
    └─ 2) Broadcast 채널 구독
          channel(`room:${roomId}`).subscribe()
          → ai-chunk, ai-done 이벤트 리스너 등록
```

### 2. 질문 전송

```
유저가 질문 입력 → 전송 버튼 클릭
    │
    ├─ 1) 질문 메시지를 로컬 state에 즉시 추가 (Optimistic UI)
    │     { question: '...', status: 'GENERATING', text: '' }
    │
    └─ 2) POST /api/chat/stream 호출 (트리거 역할)
          body: { room_id, message, ... }
          → HTTP 응답 body는 읽지 않음 (답변은 Broadcast로 수신)
```

### 3. 서버 처리 (API Route)

```
POST /api/chat/stream 수신
    │
    ├─ 1) 인증 검증 (verifySupabaseToken)
    │
    ├─ 2) Broadcast 채널 열기
    │     channel(`room:${roomId}`).subscribe()
    │
    ├─ 3) AI 서버에 SSE 요청
    │     fetch(`${AI_SERVER_URL}/chat/stream`, { body })
    │
    ├─ 4) SSE 스트림 읽기 + Broadcast 중계
    │     for chunk of stream:
    │       channel.send({ type: 'broadcast', event: 'ai-chunk', payload: { text, type, ... } })
    │       누적 텍스트/코드 저장
    │
    ├─ 5) 스트리밍 완료
    │     channel.send({ type: 'broadcast', event: 'ai-done', payload: { messageId } })
    │
    ├─ 6) DB에 최종 메시지 INSERT
    │     supabase.from('chat_messages').insert({
    │       room_id, question, text, content, path,
    │       status: 'DONE',
    │       question_created_at, answer_created_at
    │     })
    │
    ├─ 7) Broadcast 채널 닫기
    │     supabase.removeChannel(channel)
    │
    └─ 8) HTTP 응답 반환 { ok: true }
```

### 4. 클라이언트 스트리밍 수신

```
Broadcast 'ai-chunk' 수신
    │
    └─ 로컬 state 업데이트
       switch (event.type):
         case 'chat':  → accumulatedText += chunk.text
         case 'code':  → generatedFiles.push(chunk)
         case 'start': → messageId 세팅
       → UI 실시간 렌더링

Broadcast 'ai-done' 수신
    │
    ├─ 1) DB에서 최신 메시지 fetch (streamingMessage는 아직 화면에 유지)
    │     select * from chat_messages
    │     where room_id = :roomId
    │       and question_created_at > :lastMessageTimestamp
    │     order by question_created_at asc
    │
    └─ 2) fetch 완료 후 batch update (같은 tick에서 처리)
          messages = [...messages, ...fetchedMessages]
          streamingMessage = null
          isLoading = false
          → React batch render로 깜빡임 없이 교체

    * key 일치 전략: streamingMessage.messageId === DB message.id
      → 같은 key를 사용하면 React가 동일 컴포넌트로 인식
      → 언마운트/리마운트 없음 → 애니메이션 재발동 방지
```

### 5. 방 이동 / 새로고침

```
방 이동 시:
    ├─ supabase.removeChannel(channel) (React cleanup)
    └─ 새 방 채널 subscribe + 메시지 fetch

새로고침 시:
    └─ 1번(방 입장)과 동일
       DB에서 fetch → 이전 질답 + 마지막 질답 모두 포함
```

---

## 메시지 State 관리

### State 구조

```typescript
interface MessageState {
  // DB에서 fetch한 완료된 메시지들
  messages: ChatMessage[]

  // 현재 스트리밍 중인 답변 (1개 또는 null)
  streamingMessage: {
    messageId: string | null
    question: string
    accumulatedText: string
    generatedFiles: CodeEvent[]
    status: 'GENERATING'
  } | null

  isLoading: boolean
}
```

### State 업데이트 순서

```
[방 입장]
  messages = DB fetch 결과 (최근 20개, reverse)
  streamingMessage = null

[질문 전송]
  streamingMessage = { question: '...', text: '', status: 'GENERATING' }
  isLoading = true

[ai-chunk 수신]
  streamingMessage.accumulatedText += chunk.text
  (또는 generatedFiles.push)

[ai-done 수신]
  1. DB fetch (streamingMessage 유지 중)
  2. fetch 완료 → batch update:
     messages.push(...fetched)
     streamingMessage = null
     isLoading = false
  (DB 기준 동기화 — 다른 유저의 답변 완료도 여기서 반영됨)
  (같은 messageId를 key로 사용 → 컴포넌트 리마운트 없음)
```

---

## 다중 유저 시나리오

### 같은 방에 유저 A, B가 있을 때

```
유저 A 질문 전송
    │
서버 → Broadcast 'ai-start' { userId: A }
    │
    ├─ 유저 A: isLoading = true (본인 질문)
    └─ 유저 B: 스트리밍 관전 모드 (입력창 비활성화 가능)

서버 → Broadcast 'ai-chunk' (반복)
    │
    ├─ 유저 A: streamingMessage 업데이트
    └─ 유저 B: streamingMessage 업데이트 (동일하게 표시)

서버 → Broadcast 'ai-done'
    │
    ├─ 유저 A: streamingMessage 초기화 → DB fetch (최신 메시지) → messages에 append
    └─ 유저 B: streamingMessage 초기화 → DB fetch (최신 메시지) → messages에 append
    → 양쪽 모두 DB 기준으로 동기화됨
```

### 스트리밍 중 다른 유저 입장

```
유저 B가 스트리밍 도중에 입장
    │
    ├─ DB fetch → 이전 완료된 메시지만 표시
    ├─ Broadcast 구독 시작 → 이후 chunk부터 수신
    ├─ 스트리밍 앞부분은 놓침 (부분 표시)
    │
    └─ ai-done 수신 시:
       DB fetch (lastMessageTimestamp 이후) → 완전한 메시지로 동기화
       → 새로고침 없이도 최종 결과 정상 표시
```

---

## Broadcast 이벤트 스펙

### 서버 → 클라이언트

| 이벤트 | payload | 설명 |
|--------|---------|------|
| `ai-start` | `{ messageId, userId }` | 스트리밍 시작, 다른 유저 입력 잠금용 |
| `ai-chunk` | `{ type: 'chat'｜'code', text?, content?, path? }` | 스트리밍 chunk |
| `ai-done` | `{ messageId }` | 스트리밍 완료, DB 저장 완료 |
| `ai-error` | `{ error: string }` | 에러 발생 |

### 이벤트 타입 (기존 SSE 이벤트와 동일)

```typescript
// 기존 SSEEvent 타입을 Broadcast에서도 재사용
type BroadcastEvent =
  | { type: 'start'; message_id: string; user_id: string }
  | { type: 'chat'; text: string }
  | { type: 'code'; content: string; path: string }
  | { type: 'done'; message_id: string }
  | { type: 'error'; error: string }
```

---

## 페이지네이션

### 초기 로딩

```typescript
// 최근 20개만 fetch
const { data } = await supabase
  .from('chat_messages')
  .select('*')
  .eq('room_id', roomId)
  .order('question_created_at', { ascending: false })
  .limit(20)

// 시간순 정렬로 뒤집기
messages = data.reverse()
```

### 이전 메시지 로드 (무한 스크롤)

```typescript
// 현재 가장 오래된 메시지의 timestamp 기준
const { data } = await supabase
  .from('chat_messages')
  .select('*')
  .eq('room_id', roomId)
  .lt('question_created_at', oldestTimestamp)
  .order('question_created_at', { ascending: false })
  .limit(20)

// 앞에 prepend
messages = [...data.reverse(), ...messages]
```

### 메시지 점프 (검색/북마크)

```
검색 결과 또는 북마크 클릭
    │
    ├─ 1) 타겟 메시지 ~ 최신 메시지까지 fetch
    │     select * from chat_messages
    │     where room_id = :roomId
    │       and question_created_at >= :targetTimestamp
    │     order by question_created_at asc
    │
    ├─ 2) 현재 메시지 리스트를 결과로 교체
    │
    ├─ 3) 타겟 메시지로 scrollIntoView + 하이라이트
    │
    └─ 4) 위로 스크롤 → 기존 단방향 무한 스크롤과 동일
          (타겟 이전 메시지 20개씩 추가 로드)
          아래로 스크롤 → 이미 최신까지 로드돼있으므로 추가 로드 불필요
```

```typescript
// 타겟 메시지 이후 전부 fetch
const { data } = await supabase
  .from('chat_messages')
  .select('*')
  .eq('room_id', roomId)
  .gte('question_created_at', targetTimestamp)
  .order('question_created_at', { ascending: true })

// 리스트 교체 + 스크롤
messages = data
scrollToMessage(targetMessageId)
```

**장점**: 기존 단방향 무한 스크롤 로직을 그대로 재사용 가능
**단점**: 타겟~최신 사이 메시지가 매우 많으면 초기 로드 증가 (실 사용에서 극히 드묾)

---

## 메시지 검색

### 텍스트 검색

```typescript
// ILIKE 기반 substring 검색 (한국어 호환)
const { data } = await supabase
  .from('chat_messages')
  .select('id, question, text, question_created_at')
  .eq('room_id', roomId)
  .or(`question.ilike.%${keyword}%,text.ilike.%${keyword}%`)
  .order('question_created_at', { ascending: false })
  .limit(20)
```

- 질문(question)과 답변(text) 모두 검색
- 결과는 별도 검색 패널에 미리보기로 표시
- 클릭 시 위의 "메시지 점프" 로직 실행

### 북마크

```
북마크 토글
    → chat_messages의 is_bookmarked 컬럼 UPDATE

북마크 목록 조회
    → select * from chat_messages
      where room_id = :roomId and is_bookmarked = true
      order by question_created_at desc

북마크 클릭
    → "메시지 점프" 로직과 동일
```

---

## Realtime Connection 제한 고려

### 플랜별 Concurrent Connection 한도

Supabase Realtime은 **채널 구독 단위**로 connection을 카운트한다.
(WebSocket 연결 수가 아닌, 전체 클라이언트의 총 채널 구독 수)

| 플랜 | Concurrent Connections |
|------|----------------------|
| Free | 200 |
| Pro | 500 |
| Pro (no spend cap) | 10,000 |
| Team | 10,000 |
| Enterprise | 10,000+ |

### 현재 설계의 유저당 Connection 소비

| 구독 | Connection | 비고 |
|------|-----------|------|
| 클라이언트 Broadcast (`room:${roomId}`) | 1 | 방 입장 시 구독, 퇴장 시 해제 |
| 서버 Broadcast (AI 스트리밍 중계) | 1 (임시) | 스트리밍 완료 후 즉시 해제 |
| **유저당 합계** | **~1** | 서버 connection은 스트리밍 중에만 존재 |

Free 플랜 기준: 동시 접속 **약 200명** 가능 (서버 임시 connection 감안 시 ~150명)

### chat_messages에 Postgres Changes를 안 쓰는 이유

`ai-done` 후 메시지 동기화를 Postgres Changes(Realtime DB 구독) 대신 **수동 DB fetch**로 처리한다.

**Postgres Changes 방식의 문제점:**

1. **타이밍 제어 불가** — DB INSERT 후 Postgres Changes 이벤트 도착까지 지연이 있을 수 있음
2. **batch 처리 불가** — `streamingMessage → messages` 전환을 같은 tick에서 처리해야 깜빡임이 없는데, Postgres Changes는 이벤트 도착 시점을 보장 못함
3. **Connection 추가 소비** — 별도 채널로 구독하면 유저당 +1 connection (같은 채널에 통합하면 회피 가능)

**수동 fetch 방식의 장점:**

1. `ai-done` 수신 → fetch → batch update를 **동기적으로 제어** 가능
2. 추가 Realtime connection **소비 없음**
3. 같은 messageId를 key로 사용하여 React 컴포넌트 리마운트 방지

```
// 현재 설계 (수동 fetch)
ai-done 수신 → DB fetch → batch update (같은 tick)
  → streamingMessage = null + messages.push(...fetched)
  → 깜빡임 없는 전환 보장

// Postgres Changes 방식 (채택하지 않음)
ai-done 수신 → streamingMessage = null
  ... (지연) ...
Postgres Changes INSERT 이벤트 → messages.push(newMessage)
  → 두 시점이 분리되어 깜빡임 발생 가능
```

---

## 에러 처리

### 서버 크래시 (스트리밍 중 서버 죽음)

```
문제: 서버가 ai-done을 보내지 못하고 죽음
    → 클라이언트는 영원히 isLoading 상태

해결:
  1. HTTP fetch의 응답을 확인 (서버 크래시 시 에러 반환)
  2. 클라이언트 타임아웃 (예: 120초 후 자동 해제)
  3. streamingMessage.status를 'ERROR'로 변경
```

```typescript
// 클라이언트 타임아웃 처리
const timeout = setTimeout(() => {
  if (isLoading) {
    setIsLoading(false)
    setError('응답 시간이 초과되었습니다')
  }
}, 120_000)
```

### Broadcast 연결 끊김

```
문제: 클라이언트 네트워크 끊김으로 chunk 유실

해결:
  1. 새로고침 → DB에서 최종 저장된 메시지 fetch
  2. Supabase SDK 자체 reconnect 로직 활용
```

### DB INSERT 실패

```
문제: 스트리밍은 완료됐는데 DB 저장 실패

해결:
  1. 서버에서 재시도 (최대 3회)
  2. 실패 시 ai-error 이벤트로 클라이언트에 알림
  3. 클라이언트는 로컬 state에 이미 데이터 있으므로 표시는 유지
  4. 새로고침 시 해당 메시지 없음 (유실)
     → 중요한 경우 클라이언트 로컬 백업 고려
```

---

## Rooms 목록 관리

### 방 목록 로딩

```
사이드바 진입
    │
    └─ DB에서 rooms fetch
       select * from chat_rooms
       where user_id = :uid
       order by created_at desc
```

### 새 방 생성

```
유저가 새 방 생성
    │
    ├─ POST /api/rooms → AI 서버 + Supabase DB INSERT
    ├─ 응답 받으면 rooms state에 즉시 추가 (Optimistic UI)
    └─ 새 방으로 라우팅
```

### Postgres Changes 없이 동기화

```
다른 탭/기기에서 방 생성 시:
    → 현재 탭에서는 새로고침 전까지 안 보임
    → 1인 사용 기준 문제 없음

필요 시 추가:
    → Postgres Changes로 chat_rooms INSERT 구독
    → 사이드바 실시간 업데이트
```
