export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type ToastType = 'default' | 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Alert type (V2: variant → type) */
  type?: ToastType;
  /** Toast title */
  title?: string;
  /** Toast message content (V2: message → body와 매핑) */
  message: React.ReactNode;
  /** Auto-dismiss duration in ms (0 = manual close only, default: 3000) */
  duration?: number;
  /** Toast position (default: 'top-right') */
  position?: ToastPosition;
  /** Action 1 */
  action1?: ToastAction;
  /** Action 2 */
  action2?: ToastAction;
  /** Show close button (V2: hasCloseButton → showClose) (default: true) */
  showClose?: boolean;
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
