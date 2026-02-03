/**
 * SSE 이벤트 타입 정의
 *
 * OpenAPI 스펙에 없는 SSE 이벤트 타입을 수동 정의
 * OpenAPI 타입은 @ds-hub/shared-types에서 직접 import하세요
 */

// SSE 이벤트 타입 (OpenAPI 스펙에 없으므로 수동 정의)
export type SSEEventType = 'start' | 'chat' | 'code' | 'done' | 'error';

export interface StartEvent {
  type: 'start';
  message_id: string;
}

export interface ChatEvent {
  type: 'chat';
  text: string;
}

export interface CodeEvent {
  type: 'code';
  path: string;
  content: string;
}

export interface DoneEvent {
  type: 'done';
  message_id: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export type SSEEvent =
  | StartEvent
  | ChatEvent
  | CodeEvent
  | DoneEvent
  | ErrorEvent;
