import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { SectionColumnContextValue } from './types';

const SectionColumnCtx = createContext<SectionColumnContextValue>({
  columnSize: 12,
  gridType: 'A',
  sectionIndex: 0,
});

export function SectionColumnProvider({
  columnSize,
  gridType,
  sectionIndex,
  children,
}: SectionColumnContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ columnSize, gridType, sectionIndex }), [columnSize, gridType, sectionIndex]);

  return <SectionColumnCtx.Provider value={value}>{children}</SectionColumnCtx.Provider>;
}

export function useSectionColumn(): SectionColumnContextValue {
  return useContext(SectionColumnCtx);
}
