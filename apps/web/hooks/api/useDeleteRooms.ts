import {
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { deleteErrorMessage } from '@/lib/utils';
import { roomKeys } from './useRoomQuery';

/** 동시에 실행할 최대 DELETE 요청 수 (AI 서버 부하 보호) */
const DELETE_CONCURRENCY = 4;

export interface DeleteRoomsResult {
  /** 삭제에 성공한 room id 목록 */
  succeededIds: string[];
  /** 삭제에 실패한 room id와 사유 */
  failed: { id: string; error: string }[];
}

type UseDeleteRoomsOptions = Omit<
  UseMutationOptions<DeleteRoomsResult, Error, string[], unknown>,
  'mutationFn'
>;

/**
 * 인덱스 포인터 기반 워커 풀 - 외부 의존성 없이 동시 실행 수를 limit으로 제한.
 * 각 task는 throw하지 않고 결과 객체를 반환하는 것을 전제로 한다.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  };
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * DELETE /api/rooms/{roomId} - 여러 채팅방을 제한 병렬로 삭제.
 *
 * - 동시 실행은 {@link DELETE_CONCURRENCY}개로 제한
 * - 부분 실패를 허용: mutationFn 자체는 throw하지 않고 성공/실패를 집계해 반환
 * - 캐시 무효화는 모든 삭제가 끝난 뒤 1회만 수행 (재조회 폭주 방지)
 * - 낙관적 업데이트 없음: 실제 성공한 항목만 캐시에서 제거
 */
export function useDeleteRooms(mutationOptions?: UseDeleteRoomsOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomIds: string[]): Promise<DeleteRoomsResult> => {
      const token = await useAuthStore.getState().getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      type Outcome =
        | { ok: true; id: string }
        | { ok: false; id: string; error: string };

      const outcomes = await runWithConcurrency<string, Outcome>(
        roomIds,
        DELETE_CONCURRENCY,
        async (roomId): Promise<Outcome> => {
          try {
            const response = await fetch(`/api/rooms/${roomId}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              // 401(미인증)·403(타인 방) 등은 사용자용 한글 메시지로 변환
              return {
                ok: false,
                id: roomId,
                error: deleteErrorMessage(response.status, 'room'),
              };
            }

            return { ok: true, id: roomId };
          } catch (error) {
            return {
              ok: false,
              id: roomId,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }
      );

      const succeededIds: string[] = [];
      const failed: { id: string; error: string }[] = [];
      for (const outcome of outcomes) {
        if (outcome.ok) {
          succeededIds.push(outcome.id);
        } else {
          failed.push({ id: outcome.id, error: outcome.error });
        }
      }

      return { succeededIds, failed };
    },
    onSuccess: (result) => {
      // 성공한 항목만 상세/메시지 캐시 제거
      result.succeededIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: roomKeys.detail(id) });
        queryClient.removeQueries({ queryKey: ['paginatedMessages', id] });
      });
      // 목록 재조회는 1건이라도 성공했을 때 1회만
      if (result.succeededIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: roomKeys.all });
      }
    },
    ...mutationOptions,
  });
}
