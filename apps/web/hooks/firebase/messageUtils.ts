import { TABLES } from '@packages/shared-types/typescript/database/collections';
import { ChatMessage } from '@packages/shared-types/typescript/database/types';

/**
 * 메시지 관련 타입 및 유틸리티
 */

/**
 * 메시지 테이블 이름
 */
export const MESSAGES_TABLE = TABLES.CHAT_MESSAGES;

/**
 * ChatMessage 타입 re-export
 */
export type { ChatMessage };
