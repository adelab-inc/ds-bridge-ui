import * as React from 'react';
import { useToastContext } from './ToastProvider';
import type { ToastOptions, ToastVariant } from './types';

type ToastFunction = {
  (options: ToastOptions): string;
  success: (message: React.ReactNode, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  error: (message: React.ReactNode, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  warning: (message: React.ReactNode, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  info: (message: React.ReactNode, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  default: (message: React.ReactNode, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
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

  // Helper to create variant-specific functions
  const createVariantFunction = React.useCallback(
    (variant: ToastVariant) => {
      return (
        message: React.ReactNode,
        options?: Omit<ToastOptions, 'message' | 'variant'>
      ) => {
        return context.addToast({ ...options, message, variant });
      };
    },
    [context]
  );

  toast.success = createVariantFunction('success');
  toast.error = createVariantFunction('error');
  toast.warning = createVariantFunction('warning');
  toast.info = createVariantFunction('info');
  toast.default = createVariantFunction('default');

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
