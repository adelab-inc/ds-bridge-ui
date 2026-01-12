import {
  QueryFieldFilterConstraint,
  QueryLimitConstraint,
  QueryOrderByConstraint,
  collection,
  limit,
  orderBy,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import {
  InfiniteData,
  UndefinedInitialDataInfiniteOptions,
  useInfiniteQuery,
} from '@tanstack/react-query';
import {
  FirestoreMessage,
  ClientMessage,
  MESSAGES_COLLECTION,
  firestoreToClientMessage,
} from './messageUtils';
import { firebaseFirestore } from '@/lib/firebase';

/**
 * Firestore에서 페이지네이션된 메시지를 가져오는 함수
 */
const fetchMessages = async ({
  sessionId,
  pageSize,
  pageParam,
}: {
  sessionId: string;
  pageSize: number;
  pageParam?: string;
}): Promise<ClientMessage[]> => {
  const queryConstraints: (
    | QueryFieldFilterConstraint
    | QueryOrderByConstraint
    | QueryLimitConstraint
  )[] = [
    where('room_id', '==', sessionId),
    orderBy('question_created_at', 'desc'),
    limit(pageSize),
  ];

  // 페이지네이션: 이전 페이지의 마지막 타임스탬프보다 이전 메시지만 가져오기
  if (pageParam) {
    queryConstraints.push(where('question_created_at', '<', pageParam));
  }

  const q = query(
    collection(firebaseFirestore, MESSAGES_COLLECTION),
    ...queryConstraints
  );

  const querySnapshot = await getDocs(q);

  // Firestore 메시지를 클라이언트 메시지로 변환하고 시간순으로 정렬
  const messages: ClientMessage[] = querySnapshot.docs
    .map((doc) => {
      const data = doc.data() as FirestoreMessage;
      return firestoreToClientMessage({ ...data, id: doc.id });
    })
    .sort((a, b) => {
      const aTime = new Date(a.question_created_at).getTime();
      const bTime = new Date(b.question_created_at).getTime();
      return aTime - bTime; // 오래된 메시지부터
    });

  return messages;
};

/**
 * 무한 스크롤 페이지네이션을 지원하는 메시지 fetch 훅
 *
 * @param sessionId - 채팅 세션 ID
 * @param pageSize - 한 페이지당 메시지 개수
 * @param startAfter - 시작 타임스탬프 (optional)
 * @param infiniteQueryOptions - TanStack Query 옵션
 *
 * @example
 * const { data, fetchNextPage, hasNextPage, isLoading } = useGetPaginatedFbMessages({
 *   sessionId: 'session-123',
 *   pageSize: 20,
 * });
 */
export const useGetPaginatedFbMessages = ({
  sessionId,
  pageSize,
  startAfter,
  infiniteQueryOptions,
}: {
  sessionId: string;
  pageSize: number;
  startAfter?: string;
  infiniteQueryOptions?: Partial<
    UndefinedInitialDataInfiniteOptions<
      ClientMessage[],
      Error,
      InfiniteData<ClientMessage[], unknown>
    >
  >;
}) => {
  return useInfiniteQuery({
    queryKey: ['paginatedMessages', sessionId, pageSize, startAfter],
    queryFn: ({ pageParam }) =>
      fetchMessages({
        sessionId,
        pageSize,
        pageParam: pageParam as string,
      }),
    getNextPageParam: (lastPage) => {
      // 마지막 페이지의 메시지 개수가 pageSize보다 적으면 더 이상 페이지가 없음
      if (lastPage.length < pageSize) {
        return undefined;
      }
      // 가장 오래된 메시지의 타임스탬프를 다음 페이지의 시작점으로 사용
      const oldestMessage = lastPage[0];
      return oldestMessage.question_created_at;
    },
    initialPageParam: startAfter,
    staleTime: 5 * 60 * 1000, // 5분
    ...infiniteQueryOptions,
  });
};
