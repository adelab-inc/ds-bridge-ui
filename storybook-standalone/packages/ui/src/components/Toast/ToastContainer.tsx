import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Alert } from '../Alert';
import { cn } from '../utils';
import type { Toast, ToastPosition } from './types';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
  onPauseTimer: (id: string) => void;
  onResumeTimer: (id: string) => void;
}

// Position styles for each toast position
const positionStyles: Record<ToastPosition, string> = {
  'top-left': 'top-4 left-4 items-start',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'top-right': 'top-4 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-4 right-4 items-end',
};

// Animation classes based on position
const getAnimationClasses = (position: ToastPosition, isExiting: boolean) => {
  const enterClasses: Record<ToastPosition, string> = {
    'top-left': 'animate-slide-in-left',
    'top-center': 'animate-slide-in-top',
    'top-right': 'animate-slide-in-right',
    'bottom-left': 'animate-slide-in-left',
    'bottom-center': 'animate-slide-in-bottom',
    'bottom-right': 'animate-slide-in-right',
  };

  const exitClasses: Record<ToastPosition, string> = {
    'top-left': 'animate-slide-out-left',
    'top-center': 'animate-slide-out-top',
    'top-right': 'animate-slide-out-right',
    'bottom-left': 'animate-slide-out-left',
    'bottom-center': 'animate-slide-out-bottom',
    'bottom-right': 'animate-slide-out-right',
  };

  return isExiting ? exitClasses[position] : enterClasses[position];
};

// Group toasts by position
const groupByPosition = (toasts: Toast[]): Record<ToastPosition, Toast[]> => {
  const groups: Record<ToastPosition, Toast[]> = {
    'top-left': [],
    'top-center': [],
    'top-right': [],
    'bottom-left': [],
    'bottom-center': [],
    'bottom-right': [],
  };

  toasts.forEach((toast) => {
    const position = toast.position ?? 'top-right';
    groups[position].push(toast);
  });

  return groups;
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
  onPauseTimer: (id: string) => void;
  onResumeTimer: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({
  toast,
  onRemove,
  onPauseTimer,
  onResumeTimer,
}) => {
  const position = toast.position ?? 'top-right';
  const animationClass = getAnimationClasses(position, toast.isExiting ?? false);

  return (
    <div
      className={animationClass}
      onMouseEnter={() => onPauseTimer(toast.id)}
      onMouseLeave={() => onResumeTimer(toast.id)}
    >
      <Alert
        isToast
        variant={toast.variant}
        title={toast.title}
        actions={toast.actions}
        hasCloseButton={toast.hasCloseButton}
        onClose={() => onRemove(toast.id)}
      >
        {toast.message}
      </Alert>
    </div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemove,
  onPauseTimer,
  onResumeTimer,
}) => {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const groupedToasts = groupByPosition(toasts);
  const positions = Object.keys(groupedToasts) as ToastPosition[];

  // Filter out positions with no toasts
  const activePositions = positions.filter(
    (position) => groupedToasts[position].length > 0
  );

  if (activePositions.length === 0) return null;

  return ReactDOM.createPortal(
    <>
      {activePositions.map((position) => {
        const positionToasts = groupedToasts[position];
        const isBottom = position.startsWith('bottom');

        return (
          <div
            key={position}
            className={cn(
              'fixed z-[9999] flex flex-col pointer-events-none',
              isBottom ? 'flex-col-reverse' : 'flex-col',
              positionStyles[position]
            )}
            style={{ gap: '8px' }}
          >
            {positionToasts.map((toast) => (
              <div key={toast.id} className="pointer-events-auto">
                <ToastItem
                  toast={toast}
                  onRemove={onRemove}
                  onPauseTimer={onPauseTimer}
                  onResumeTimer={onResumeTimer}
                />
              </div>
            ))}
          </div>
        );
      })}
    </>,
    document.body
  );
};
