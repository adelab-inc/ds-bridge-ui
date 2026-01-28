import { createContext, useContext, ReactNode } from 'react';

/**
 * Spacing density mode for the entire UI system
 * - base: Standard spacing (8px, 16px, etc.)
 * - compact: Reduced spacing (6px, 12px, etc.) - approximately 25% reduction
 */
export type SpacingMode = 'base' | 'compact';

const SpacingModeContext = createContext<SpacingMode>('base');

export interface SpacingModeProviderProps {
  /**
   * Spacing mode to apply to all child components
   * @default 'base'
   */
  mode?: SpacingMode;
  children: ReactNode;
}

/**
 * SpacingModeProvider
 *
 * Provides spacing mode context to all child components.
 * Can be nested to override parent mode for specific sections.
 *
 * @example
 * // Global mode
 * <SpacingModeProvider mode="compact">
 *   <App />
 * </SpacingModeProvider>
 *
 * @example
 * // Per-page mode
 * <SpacingModeProvider mode="base">
 *   <Dashboard />
 * </SpacingModeProvider>
 *
 * @example
 * // Nested override
 * <SpacingModeProvider mode="base">
 *   <App>
 *     <SpacingModeProvider mode="compact">
 *       <DataGrid />
 *     </SpacingModeProvider>
 *   </App>
 * </SpacingModeProvider>
 */
export function SpacingModeProvider({ mode, children }: SpacingModeProviderProps) {
  const parentMode = useContext(SpacingModeContext);
  // mode prop이 명시적으로 전달되면 사용, 아니면 부모 mode 상속
  const currentMode = mode !== undefined ? mode : parentMode;

  return (
    <SpacingModeContext.Provider value={currentMode}>
      {children}
    </SpacingModeContext.Provider>
  );
}

/**
 * Hook to access current spacing mode from context
 *
 * @returns Current spacing mode ('base' or 'compact')
 *
 * @example
 * const mode = useSpacingMode();
 * // mode === 'base' or 'compact'
 */
export function useSpacingMode(): SpacingMode {
  return useContext(SpacingModeContext);
}
