import { useEffect, useState, useRef } from 'react';
import {
  QueryFieldFilterConstraint,
  QueryLimitConstraint,
  QueryOrderByConstraint,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { ChatMessage, MESSAGES_COLLECTION } from './messageUtils';
import { firebaseFirestore } from '@/lib/firebase';

interface RealtimeMessagesCallbacks {
  onInitial?: (messages: ChatMessage[]) => void;
  onAdded?: (message: ChatMessage) => void;
  onModified?: (message: ChatMessage) => void;
  onRemoved?: (message: ChatMessage) => void;
}

interface UseRealtimeMessagesOptions {
  sessionId: string;
  pageSize?: number;
  callbacks?: RealtimeMessagesCallbacks;
}

/**
 * Firestore 메시지를 실시간으로 구독하는 훅
 *
 * @param sessionId - 채팅 세션 ID
 * @param pageSize - 가져올 메시지 개수 제한 (optional)
 * @param callbacks - 메시지 변경 시 호출될 콜백 함수들
 *
 * @example
 * const { messages, isLoading, error } = useRealtimeMessages({
 *   sessionId: 'session-123',
 *   pageSize: 50,
 *   callbacks: {
 *     onAdded: (msg) => console.log('New message:', msg),
 *   }
 * });
 */
export const useRealtimeMessages = ({
  sessionId,
  pageSize,
  callbacks,
}: UseRealtimeMessagesOptions) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(!!sessionId);
  const [error, setError] = useState<string | null>(null);

  // 콜백을 ref로 관리하여 의존성 문제 해결
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const collectionRef = collection(firebaseFirestore, MESSAGES_COLLECTION);

    const queryConstraints: (
      | QueryFieldFilterConstraint
      | QueryOrderByConstraint
      | QueryLimitConstraint
    )[] = [where('room_id', '==', sessionId), orderBy('question_created_at', 'desc')];

    if (pageSize) {
      queryConstraints.push(limit(pageSize));
    }

    const q = query(collectionRef, ...queryConstraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // 첫 번째 스냅샷인지 확인
        const isFirstSnapshot =
          snapshot.docChanges().every((change) => change.type === 'added') &&
          snapshot.docChanges().length === snapshot.docs.length;

        if (isFirstSnapshot) {
          // 첫 로딩: 모든 기존 메시지 가져오기
          const initialMessages: ChatMessage[] = snapshot.docs
            .map((doc) => {
              const data = doc.data() as Omit<ChatMessage, 'id'>;
              return { ...data, id: doc.id } as ChatMessage;
            })
            .sort((a, b) => a.question_created_at - b.question_created_at);

          setMessages(initialMessages);
          callbacksRef.current?.onInitial?.(initialMessages);
          setIsLoading(false);
        } else {
          // 실시간 변경사항 처리
          snapshot.docChanges().forEach((change) => {
            const data = change.doc.data() as Omit<ChatMessage, 'id'>;
            const msg: ChatMessage = { ...data, id: change.doc.id };

            if (change.type === 'added') {
              setMessages((prev) => {
                const updated = [...prev, msg].sort(
                  (a, b) => a.question_created_at - b.question_created_at
                );
                return updated;
              });
              callbacksRef.current?.onAdded?.(msg);
            }

            if (change.type === 'modified') {
              setMessages((prev) => {
                const updated = prev
                  .map((m) => (m.id === msg.id ? msg : m))
                  .sort((a, b) => a.question_created_at - b.question_created_at);
                return updated;
              });
              callbacksRef.current?.onModified?.(msg);
            }

            if (change.type === 'removed') {
              setMessages((prev) => prev.filter((m) => m.id !== msg.id));
              callbacksRef.current?.onRemoved?.(msg);
            }
          });
        }
      },
      (err) => {
        console.error('Firebase onSnapshot error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [sessionId, pageSize]);

  return { messages, error, isLoading };
};
