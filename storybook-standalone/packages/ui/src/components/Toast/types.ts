import type { AlertActions } from '../Alert';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type ToastVariant = 'default' | 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  /** Toast variant */
  variant?: ToastVariant;
  /** Toast title */
  title?: string;
  /** Toast message content */
  message: React.ReactNode;
  /** Auto-dismiss duration in ms (0 = manual close only, default: 3000) */
  duration?: number;
  /** Toast position (default: 'top-right') */
  position?: ToastPosition;
  /** Action buttons (max 2) */
  actions?: AlertActions;
  /** Show close button (default: true) */
  hasCloseButton?: boolean;
}

export interface Toast extends ToastOptions {
  /** Unique toast ID */
  id: string;
  /** Creation timestamp */
  createdAt: number;
  /** Whether toast is being removed (for exit animation) */
  isExiting?: boolean;
}

export interface ToastContextValue {
  /** All active toasts */
  toasts: Toast[];
  /** Add a new toast */
  addToast: (options: ToastOptions) => string;
  /** Remove a toast by ID */
  removeToast: (id: string) => void;
  /** Update a toast */
  updateToast: (id: string, options: Partial<ToastOptions>) => void;
  /** Remove all toasts */
  clearToasts: () => void;
}
