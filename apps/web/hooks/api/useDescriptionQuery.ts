import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import type {
  Description,
  DescriptionVersionSummary,
} from '@ds-hub/shared-types/typescript/database/description';
import { useAuthStore } from '@/stores/useAuthStore';

// --- Query Keys ---

export const descriptionKeys = {
  all: ['descriptions'] as const,
  latest: (roomId: string) =>
    [...descriptionKeys.all, 'latest', roomId] as const,
  versions: (roomId: string) =>
    [...descriptionKeys.all, 'versions', roomId] as const,
  version: (roomId: string, id: string) =>
    [...descriptionKeys.all, 'version', roomId, id] as const,
};

// --- Query Hooks ---

type UseLatestDescriptionOptions = Omit<
  UseQueryOptions<
    Description,
    Error,
    Description,
    ReturnType<typeof descriptionKeys.latest>
  >,
  'queryKey' | 'queryFn'
>;

/**
 * GET /api/description/{room_id} — 최신 디스크립션 조회
 */
export function useLatestDescription(
  roomId: string | null,
  queryOptions?: UseLatestDescriptionOptions
) {
  return useQuery({
    queryKey: descriptionKeys.latest(roomId || ''),
    queryFn: async (): Promise<Description> => {
      if (!roomId) throw new Error('Room ID is required');

      const token = await useAuthStore.getState().getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/description/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Description not found');
        }
        throw new Error(
          `Failed to fetch description: ${response.statusText}`
        );
      }

      return response.json();
    },
    enabled: !!roomId,
    retry: false,
    staleTime: 0,
    ...queryOptions,
  });
}

interface VersionsResponse {
  versions: DescriptionVersionSummary[];
}

type UseDescriptionVersionsOptions = Omit<
  UseQueryOptions<
    VersionsResponse,
    Error,
    VersionsResponse,
    ReturnType<typeof descriptionKeys.versions>
  >,
  'queryKey' | 'queryFn'
>;

/**
 * GET /api/description/{room_id}/versions — 버전 목록 조회
 */
export function useDescriptionVersions(
  roomId: string | null,
  queryOptions?: UseDescriptionVersionsOptions
) {
  return useQuery({
    queryKey: descriptionKeys.versions(roomId || ''),
    queryFn: async (): Promise<VersionsResponse> => {
      if (!roomId) throw new Error('Room ID is required');

      const token = await useAuthStore.getState().getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/description/${roomId}/versions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch versions: ${response.statusText}`
        );
      }

      return response.json();
    },
    enabled: !!roomId,
    retry: false,
    staleTime: 0,
    ...queryOptions,
  });
}

type UseDescriptionVersionOptions = Omit<
  UseQueryOptions<
    Description,
    Error,
    Description,
    ReturnType<typeof descriptionKeys.version>
  >,
  'queryKey' | 'queryFn'
>;

/**
 * GET /api/description/{room_id}/versions/{id} — 특정 버전 조회
 */
export function useDescriptionVersion(
  roomId: string | null,
  id: string | null,
  queryOptions?: UseDescriptionVersionOptions
) {
  return useQuery({
    queryKey: descriptionKeys.version(roomId || '', id || ''),
    queryFn: async (): Promise<Description> => {
      if (!roomId || !id) throw new Error('Room ID and version ID are required');

      const token = await useAuthStore.getState().getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/description/${roomId}/versions/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Description version not found');
        }
        throw new Error(
          `Failed to fetch version: ${response.statusText}`
        );
      }

      return response.json();
    },
    enabled: !!roomId && !!id,
    retry: false,
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  });
}

// --- Mutation Hooks ---

interface ExtractDescriptionRequest {
  room_id: string;
  current_code?: string;
  current_code_path?: string;
  edit_history?: {
    original: string;
    edited: string;
  };
}

type UseExtractDescriptionOptions = Omit<
  UseMutationOptions<Description, Error, ExtractDescriptionRequest, unknown>,
  'mutationFn'
>;

/**
 * POST /api/description/extract — 디스크립션 추출
 */
export function useExtractDescription(
  mutationOptions?: UseExtractDescriptionOptions
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: ExtractDescriptionRequest
    ): Promise<Description> => {
      const token = await useAuthStore.getState().getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/description/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const msg = errorData?.detail?.[0]?.msg || response.statusText;
        throw new Error(`Failed to extract description: ${msg}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      // 최신 디스크립션 캐시 업데이트 + 버전 목록 갱신
      queryClient.setQueryData(
        descriptionKeys.latest(data.room_id),
        data
      );
      queryClient.invalidateQueries({
        queryKey: descriptionKeys.versions(data.room_id),
      });
    },
    ...mutationOptions,
  });
}

interface SaveEditRequest {
  roomId: string;
  edited_content: string;
}

type UseSaveEditHistoryOptions = Omit<
  UseMutationOptions<Description, Error, SaveEditRequest, unknown>,
  'mutationFn'
>;

/**
 * PUT /api/description/{room_id}/edit — 편집 이력 저장
 */
export function useSaveEditHistory(
  mutationOptions?: UseSaveEditHistoryOptions
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SaveEditRequest): Promise<Description> => {
      const token = await useAuthStore.getState().getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/description/${data.roomId}/edit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ edited_content: data.edited_content }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const msg = errorData?.detail?.[0]?.msg || response.statusText;
        throw new Error(`Failed to save edit: ${msg}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        descriptionKeys.latest(data.room_id),
        data
      );
    },
    ...mutationOptions,
  });
}
