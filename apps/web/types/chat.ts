// 요청 body 타입
export interface ChatStreamRequest {
  message: string;
  schema_key?: string;
}

// SSE 이벤트 타입
export type SSEEventType = 'text' | 'code' | 'done' | 'error';

export interface ChatEvent {
  type: 'text';
  text: string;
}

export interface CodeEvent {
  type: 'code';
  path: string;
  content: string;
}

export interface DoneEvent {
  type: 'done';
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export type SSEEvent = ChatEvent | CodeEvent | DoneEvent | ErrorEvent;

// Validation Error 타입
export interface ValidationError {
  detail: Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}
