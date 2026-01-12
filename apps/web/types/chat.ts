/**
 * Chat API 타입 정의
 *
 * - 요청/응답 타입: @ds-hub/shared-types (OpenAPI에서 자동 생성)
 * - SSE 이벤트 타입: 이 파일에서 수동 정의
 */

import type {
  paths,
  components,
} from '@ds-hub/shared-types/typescript/api/schema';

// OpenAPI에서 자동 생성된 타입 re-export
export type ChatSendRequest =
  paths['/chat']['post']['requestBody']['content']['application/json'];
export type ChatSendResponse =
  paths['/chat']['post']['responses']['200']['content']['application/json'];
export type ChatStreamRequest =
  paths['/chat/stream']['post']['requestBody']['content']['application/json'];
export type ValidationError = components['schemas']['HTTPValidationError'];
export type Message = components['schemas']['Message'];
export type RoomResponse = components['schemas']['RoomResponse'];

// SSE 이벤트 타입 (OpenAPI 스펙에 없으므로 수동 정의)
export type SSEEventType = 'chat' | 'code' | 'done' | 'error';

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
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export type SSEEvent = ChatEvent | CodeEvent | DoneEvent | ErrorEvent;
