import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { COLLECTIONS } from '@packages/shared-types/typescript/firebase/collections';
import type { ChatRoom } from '@packages/shared-types/typescript/firebase/types';
import { firebaseFirestore } from '@/lib/firebase';
import { useAuthStore } from '@/stores/useAuthStore';

interface UseRoomsListReturn {
  rooms: ChatRoom[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Firestore chat_rooms 컬렉션에서 현재 유저의 룸 목록을 실시간으로 구독
 */
export function useRoomsList(): UseRoomsListReturn {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  const uid = user?.uid;
  const shouldSubscribe = !isAuthLoading && !!uid;

  // uid 변경 시 상태 리셋 (렌더 중 상태 조정 패턴)
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevUid, setPrevUid] = useState(uid);
  if (uid !== prevUid) {
    setPrevUid(uid);
    setRooms([]);
    setIsLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!shouldSubscribe || !uid) {
      return;
    }

    const collectionRef = collection(firebaseFirestore, COLLECTIONS.CHAT_ROOMS);
    const q = query(
      collectionRef,
      where('user_id', '==', uid),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ChatRoom[];
        setRooms(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Failed to fetch rooms list:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [shouldSubscribe, uid]);

  // 구독 대상이 아니면 빈 상태 반환
  if (!shouldSubscribe) {
    return { rooms: [], isLoading: false, error: null };
  }

  return { rooms, isLoading, error };
}
