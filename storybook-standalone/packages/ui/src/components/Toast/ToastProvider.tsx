import * as React from 'react';
import { ToastContainer } from './ToastContainer';
import type { Toast, ToastContextValue, ToastOptions, ToastPosition } from './types';

const ToastContext = React.createContext<ToastContextValue | null>(null);

export interface ToastProviderProps {
  children: React.ReactNode;
  /** Default position for toasts (default: 'top-right') */
  defaultPosition?: ToastPosition;
  /** Default duration in ms (default: 3000) */
  defaultDuration?: number;
  /** Maximum toasts per position (default: 5) */
  maxToasts?: number;
}

let toastCounter = 0;
const generateId = () => `toast-${++toastCounter}-${Date.now()}`;

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultPosition = 'top-right',
  defaultDuration = 3000,
  maxToasts = 5,
}) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timersRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clear timer for a specific toast
  const clearTimer = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // Start auto-dismiss timer
  const startTimer = React.useCallback((id: string, duration: number) => {
    if (duration <= 0) return;

    clearTimer(id);
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    timersRef.current.set(id, timer);
  }, []);

  // Remove toast with exit animation
  const removeToast = React.useCallback((id: string) => {
    clearTimer(id);

    // Set isExiting for animation
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, isExiting: true } : toast
      )
    );

    // Remove after animation duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300); // Animation duration
  }, [clearTimer]);

  // Add new toast
  const addToast = React.useCallback((options: ToastOptions): string => {
    const id = generateId();
    const position = options.position ?? defaultPosition;
    const duration = options.duration ?? defaultDuration;

    const newToast: Toast = {
      ...options,
      id,
      position,
      duration,
      createdAt: Date.now(),
      hasCloseButton: options.hasCloseButton ?? true,
    };

    setToasts((prev) => {
      // Filter toasts by position and limit
      const positionToasts = prev.filter((t) => t.position === position && !t.isExiting);

      // If max reached, remove oldest
      if (positionToasts.length >= maxToasts) {
        const oldestId = positionToasts[0]?.id;
        if (oldestId) {
          clearTimer(oldestId);
          // Mark for removal
          return [
            ...prev.map((t) => (t.id === oldestId ? { ...t, isExiting: true } : t)),
            newToast,
          ];
        }
      }

      return [...prev, newToast];
    });

    // Start auto-dismiss timer
    if (duration > 0) {
      startTimer(id, duration);
    }

    return id;
  }, [defaultPosition, defaultDuration, maxToasts, startTimer, clearTimer]);

  // Update existing toast
  const updateToast = React.useCallback((id: string, options: Partial<ToastOptions>) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, ...options } : toast
      )
    );

    // Reset timer if duration changed
    if (options.duration !== undefined) {
      const toast = toasts.find((t) => t.id === id);
      if (toast) {
        startTimer(id, options.duration);
      }
    }
  }, [toasts, startTimer]);

  // Clear all toasts
  const clearToasts = React.useCallback(() => {
    timersRef.current.forEach((_, id) => clearTimer(id));
    setToasts([]);
  }, [clearTimer]);

  // Pause timer on hover
  const pauseTimer = React.useCallback((id: string) => {
    clearTimer(id);
  }, [clearTimer]);

  // Resume timer on mouse leave
  const resumeTimer = React.useCallback((id: string) => {
    const toast = toasts.find((t) => t.id === id);
    if (toast && toast.duration && toast.duration > 0) {
      // Calculate remaining time
      const elapsed = Date.now() - toast.createdAt;
      const remaining = Math.max(toast.duration - elapsed, 1000); // At least 1 second
      startTimer(id, remaining);
    }
  }, [toasts, startTimer]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const contextValue: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    updateToast,
    clearToasts,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer
        toasts={toasts}
        onRemove={removeToast}
        onPauseTimer={pauseTimer}
        onResumeTimer={resumeTimer}
      />
    </ToastContext.Provider>
  );
};

export const useToastContext = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};

export { ToastContext };
