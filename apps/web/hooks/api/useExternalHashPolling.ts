'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { EXTERNAL_POLLING } from '@/lib/constants';
import { descriptionKeys } from './useDescriptionQuery';
import { messageKeys } from './messageKeys';

interface ExternalCodeHashResponse {
  crid: string;
  code_hash: string | null;
  code_hash_short?: string | null;
  generated_at?: number;
}

interface ExternalDescriptionHashResponse {
  crid: string;
  description_hash: string | null;
  description_hash_short?: string | null;
  version?: number;
  updated_at?: number;
}

/**
 * 해시 전용 EP를 호출한다. 미인증/4xx(데이터 없음·키 오류 등)는 `null` 로 처리해
 * 조용히 무시 → 폴링은 유지하되 변경 감지만 스킵 (무한 에러/토스트 방지).
 */
async function fetchExternalHash<T>(path: string): Promise<T | null> {
  const token = await useAuthStore.getState().getIdToken();
  if (!token) return null;
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/**
 * 외부 조회 API(`/external/*`)의 해시 EP를 경량 폴링해 콘텐츠 변경을 감지하고
 * 관련 React Query 캐시를 무효화(=자동 재조회)한다.
 *
 * - 직전 폴링 해시(풀 64자)와 달라졌을 때만 무효화 → 토큰/대역폭 절약
 * - `crid`(= room_id) 가 없으면 비활성
 * - 백그라운드 탭에서는 폴링 정지(`refetchIntervalInBackground: false`)
 *
 * 단일 인스턴스로 마운트할 것(RoomProvider). 여러 곳에서 호출하면 중복 폴링된다.
 */
export function useExternalHashPolling(crid: string | null) {
  const queryClient = useQueryClient();

  const { data: codeHash } = useQuery({
    queryKey: ['external', 'code', 'hash', crid],
    queryFn: () =>
      fetchExternalHash<ExternalCodeHashResponse>(
        `/api/external/code/hash/${crid}`
      ),
    enabled: !!crid,
    staleTime: 0,
    retry: false,
    refetchInterval: EXTERNAL_POLLING.HASH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    // 정주기 폴링만 유지 — 포커스/재연결 시 추가 버스트 요청 차단
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: descHash } = useQuery({
    queryKey: ['external', 'description', 'hash', crid],
    queryFn: () =>
      fetchExternalHash<ExternalDescriptionHashResponse>(
        `/api/external/description/hash/${crid}`
      ),
    enabled: !!crid,
    staleTime: 0,
    retry: false,
    refetchInterval: EXTERNAL_POLLING.HASH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    // 정주기 폴링만 유지 — 포커스/재연결 시 추가 버스트 요청 차단
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // 직전 폴링 해시(비교 기준). 풀 해시(64자)로 비교한다.
  const lastCodeHashRef = React.useRef<string | null>(null);
  const lastDescHashRef = React.useRef<string | null>(null);

  // 룸 전환 시 비교 기준 초기화 (이전 룸 해시와 오비교 방지)
  React.useEffect(() => {
    lastCodeHashRef.current = null;
    lastDescHashRef.current = null;
  }, [crid]);

  // 코드 해시 변경 → 메시지 목록 재조회
  React.useEffect(() => {
    const next = codeHash?.code_hash ?? null;
    if (!crid || next === null) return;
    const prev = lastCodeHashRef.current;
    lastCodeHashRef.current = next;
    if (prev !== null && prev !== next) {
      queryClient.invalidateQueries({ queryKey: messageKeys.byRoom(crid) });
    }
  }, [codeHash, crid, queryClient]);

  // 디스크립션 해시 변경 → 최신본/버전목록 재조회
  React.useEffect(() => {
    const next = descHash?.description_hash ?? null;
    if (!crid || next === null) return;
    const prev = lastDescHashRef.current;
    lastDescHashRef.current = next;
    if (prev !== null && prev !== next) {
      queryClient.invalidateQueries({ queryKey: descriptionKeys.latest(crid) });
      queryClient.invalidateQueries({
        queryKey: descriptionKeys.versions(crid),
      });
    }
  }, [descHash, crid, queryClient]);
}
