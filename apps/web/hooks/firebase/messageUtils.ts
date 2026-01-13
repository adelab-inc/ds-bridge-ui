import { COLLECTIONS } from '@packages/shared-types/typescript/firebase/collections';
import { ChatMessage } from '@packages/shared-types/typescript/firebase/types';

/**
 * Firebase 메시지 관련 타입 및 유틸리티
 */

/**
 * Firestore 메시지 컬렉션 이름
 */
export const MESSAGES_COLLECTION = COLLECTIONS.CHAT_MESSAGES;

/**
 * ChatMessage 타입 re-export
 */
export type { ChatMessage };
