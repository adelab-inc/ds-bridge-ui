/**
 * Room API 타입 정의
 *
 * OpenAPI에서 자동 생성된 타입 사용
 */

import type {
  paths,
  components,
} from '@ds-hub/shared-types/typescript/api/schema';

// POST /rooms - 채팅방 생성
export type CreateRoomRequest =
  paths['/rooms']['post']['requestBody']['content']['application/json'];
export type CreateRoomResponse =
  paths['/rooms']['post']['responses']['201']['content']['application/json'];

// GET /rooms/{room_id} - 채팅방 조회
export type GetRoomResponse =
  paths['/rooms/{room_id}']['get']['responses']['200']['content']['application/json'];

// RoomResponse 스키마
export type RoomResponse = components['schemas']['RoomResponse'];
