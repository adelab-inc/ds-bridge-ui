import { 
  COLLECTIONS,
  ChatMessagesDocument 
} from '@packages/shared-types/typescript/firebase/collections';

/**
 * Firebase 메시지 관련 타입 및 유틸리티
 */

/**
 * Firestore에 저장되는 메시지 타입 (ChatMessagesDocument 사용)
 */
export type FirestoreMessage = ChatMessagesDocument;

/**
 * 클라이언트에서 사용하는 메시지 타입
 */
export interface ClientMessage {
  id: string;
  status: 'ERROR' | 'DONE' | 'GENERATING';
  content: string;
  path: string;
  text: string;
  room_id: string;
  question_created_at: string;
  answer_created_at?: string;
  answer_completed: boolean;
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
    status: firestoreMsg.status,
    content: firestoreMsg.content,
    path: firestoreMsg.path,
    text: firestoreMsg.text,
    room_id: firestoreMsg.room_id,
    question_created_at: firestoreMsg.question_created_at,
    answer_created_at: firestoreMsg.answer_created_at,
    answer_completed: firestoreMsg.answer_completed,
  };
};

/**
 * 클라이언트 메시지를 Firestore 메시지로 변환
 */
export const clientToFirestoreMessage = (
  clientMsg: ClientMessage
): Omit<FirestoreMessage, 'id'> => {
  return {
    status: clientMsg.status,
    content: clientMsg.content,
    path: clientMsg.path,
    text: clientMsg.text,
    room_id: clientMsg.room_id,
    question_created_at: clientMsg.question_created_at,
    answer_created_at: clientMsg.answer_created_at,
    answer_completed: clientMsg.answer_completed,
  };
};
