/**
 * SSE 이벤트 타입 정의
 *
 * OpenAPI 스펙에 없는 SSE 이벤트 타입을 수동 정의
 * OpenAPI 타입은 @ds-hub/shared-types에서 직접 import하세요
 */

import type { paths } from '@ds-hub/shared-types/typescript/api/schema';

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

// === 이미지 업로드 관련 타입 ===

/** 이미지 업로드 API 응답 (백엔드 POST /rooms/{room_id}/images) */
export interface ImageUploadResponse {
  url: string; // Firebase Storage public URL
  path: string; // Storage path
}

/** 프론트엔드 첨부 이미지 상태 */
export interface AttachedImage {
  id: string; // 로컬 고유 ID (crypto.randomUUID)
  file: File; // 원본 파일
  previewUrl: string; // blob URL (미리보기용)
  uploadedUrl?: string; // 업로드 완료 후 Storage URL
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number; // 0-100
}

/**
 * ChatStreamRequest 확장 (image_urls 포함)
 *
 * OpenAPI 스키마에 아직 image_urls가 없어서 수동 확장.
 * 백엔드 ChatRequest에는 image_urls: list[str] | None (max 5) 필드가 존재.
 */
type ChatStreamRequest =
  paths['/chat/stream']['post']['requestBody']['content']['application/json'];

export type ChatStreamRequestWithImages = ChatStreamRequest & {
  image_urls?: string[];
};
