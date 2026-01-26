'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Message01Icon,
  Layers02Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LAYOUT } from '@/lib/constants';

interface MobileSheetProps extends React.ComponentProps<'div'> {
  chatContent?: React.ReactNode;
  componentsContent?: React.ReactNode;
  actionsContent?: React.ReactNode;
  defaultTab?: 'chat' | 'components' | 'actions';
}

function MobileSheet({
  className,
  chatContent,
  componentsContent,
  actionsContent,
  defaultTab = 'chat',
  ...props
}: MobileSheetProps) {
  const [height, setHeight] = React.useState<number>(
    LAYOUT.MOBILE_SHEET_DEFAULT_HEIGHT
  );
  const [isDragging, setIsDragging] = React.useState(false);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const startYRef = React.useRef(0);
  const startHeightRef = React.useRef(0);

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = clientY;
    startHeightRef.current = height;
  };

  const handleDragMove = React.useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (!isDragging) return;

      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = startYRef.current - clientY;
      const deltaVh = (deltaY / window.innerHeight) * 100;
      const newHeight = Math.min(
        Math.max(
          startHeightRef.current + deltaVh,
          LAYOUT.MOBILE_SHEET_MIN_HEIGHT
        ),
        LAYOUT.MOBILE_SHEET_MAX_HEIGHT
      );
      setHeight(newHeight);
    },
    [isDragging]
  );

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  return (
    <div
      ref={sheetRef}
      data-slot="mobile-sheet"
      className={cn(
        'bg-background border-border fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-xl border-t shadow-lg md:hidden',
        isDragging && 'select-none',
        className
      )}
      style={{ height: `${height}vh` }}
      {...props}
    >
      {/* Drag Handle */}
      <div
        className="flex h-6 cursor-grab items-center justify-center active:cursor-grabbing"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="bg-muted-foreground/30 h-1 w-12 rounded-full" />
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue={defaultTab}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="mx-4 shrink-0">
          <TabsTrigger value="chat" className="flex-1 gap-1.5">
            <HugeiconsIcon
              icon={Message01Icon}
              className="size-4"
              strokeWidth={2}
            />
            <span className="hidden xs:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="components" className="flex-1 gap-1.5">
            <HugeiconsIcon
              icon={Layers02Icon}
              className="size-4"
              strokeWidth={2}
            />
            <span className="hidden xs:inline">Components</span>
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex-1 gap-1.5">
            <HugeiconsIcon
              icon={Settings02Icon}
              className="size-4"
              strokeWidth={2}
            />
            <span className="hidden xs:inline">Actions</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">{chatContent}</div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="components" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">{componentsContent}</div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="actions" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">{actionsContent}</div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { MobileSheet };
export type { MobileSheetProps };
