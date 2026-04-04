import * as React from 'react';
import { useToastContext } from './ToastProvider';
import type { ToastOptions, ToastType } from './types';

type ToastFunction = {
  (options: ToastOptions): string;
  success: (message: React.ReactNode, options?: Omit<ToastOptions, 'message' | 'type'>) => string;
  error: (message: React.ReactNode, options?: Omit<ToastOptions, 'message' | 'type'>) => string;
  warning: (message: React.ReactNode, options?: Omit<ToastOptions, 'message' | 'type'>) => string;
  info: (message: React.ReactNode, options?: Omit<ToastOptions, 'message' | 'type'>) => string;
  default: (message: React.ReactNode, options?: Omit<ToastOptions, 'message' | 'type'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

export const useToast = (): ToastFunction => {
  const context = useToastContext();

  const toast = React.useCallback(
    (options: ToastOptions) => {
      return context.addToast(options);
    },
    [context]
  ) as ToastFunction;

  // Helper to create type-specific functions
  const createTypeFunction = React.useCallback(
    (type: ToastType) => {
      return (
        message: React.ReactNode,
        options?: Omit<ToastOptions, 'message' | 'type'>
      ) => {
        return context.addToast({ ...options, message, type });
      };
    },
    [context]
  );

  toast.success = createTypeFunction('success');
  toast.error = createTypeFunction('error');
  toast.warning = createTypeFunction('warning');
  toast.info = createTypeFunction('info');
  toast.default = createTypeFunction('default');

  toast.dismiss = React.useCallback(
    (id: string) => {
      context.removeToast(id);
    },
    [context]
  );

  toast.dismissAll = React.useCallback(() => {
    context.clearToasts();
  }, [context]);

  return toast;
};
