'use client';

import * as React from 'react';
import { useRoom } from '@/hooks/useRoom';
import { useExternalHashPolling } from '@/hooks/api/useExternalHashPolling';
import type { components } from '@ds-hub/shared-types/typescript/api/schema';

type RoomResponse = components['schemas']['RoomResponse'];

interface RoomContextValue {
  roomId: string | null;
  room: RoomResponse | null;
  isLoading: boolean;
  error: string | null;
}

const RoomContext = React.createContext<RoomContextValue | null>(null);

interface RoomProviderProps {
  children: React.ReactNode;
  storybookUrl?: string;
  userId?: string;
}

export function RoomProvider({ children, storybookUrl, userId }: RoomProviderProps) {
  const value = useRoom({ storybookUrl, userId });

  // 외부 조회 해시 EP를 폴링해 코드/디스크립션 변경을 감지하고 자동 갱신 (단일 마운트)
  useExternalHashPolling(value.roomId);

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoomContext(): RoomContextValue {
  const context = React.useContext(RoomContext);
  if (!context) {
    throw new Error('useRoomContext must be used within a RoomProvider');
  }
  return context;
}
