import { COLLECTIONS } from '@packages/shared-types/typescript/firebase/collections';

/**
 * Firebase 메시지 관련 타입 및 유틸리티
 */

/**
 * Firestore에 저장되는 메시지 타입
 * timestamp는 Firestore Timestamp 또는 number로 저장됨
 */
export interface FirestoreMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number; // Unix timestamp (milliseconds)
  sessionId: string; // 채팅 세션 ID
  userId?: string; // 사용자 ID (optional)
}

/**
 * 클라이언트에서 사용하는 메시지 타입 (ChatMessage와 호환)
 */
export interface ClientMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

/**
 * Firestore 메시지 컬렉션 이름
 */
export const MESSAGES_COLLECTION = COLLECTIONS.CHAT_MESSAGES;

/**
 * Firestore 메시지를 클라이언트 메시지로 변환
 */
export const firestoreToClientMessage = (
  firestoreMsg: FirestoreMessage
): ClientMessage => {
  return {
    id: firestoreMsg.id,
    role: firestoreMsg.role,
    content: firestoreMsg.content,
    timestamp: new Date(firestoreMsg.timestamp),
  };
};

/**
 * 클라이언트 메시지를 Firestore 메시지로 변환
 */
export const clientToFirestoreMessage = (
  clientMsg: ClientMessage,
  sessionId: string,
  userId?: string
): Omit<FirestoreMessage, 'id'> => {
  return {
    role: clientMsg.role,
    content: clientMsg.content,
    timestamp: clientMsg.timestamp?.getTime() || Date.now(),
    sessionId,
    userId,
  };
};
