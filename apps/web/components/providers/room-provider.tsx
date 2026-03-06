'use client';

import * as React from 'react';
import { useRoom } from '@/hooks/useRoom';
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
