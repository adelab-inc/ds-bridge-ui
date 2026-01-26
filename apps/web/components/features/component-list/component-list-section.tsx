'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Layers02Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ComponentTree } from './component-tree';
import type { ComponentItemData } from './component-item';

interface ComponentListSectionProps extends Omit<
  React.ComponentProps<'section'>,
  'onSelect'
> {
  components?: ComponentItemData[];
  selectedId?: string;
  onSelectItem?: (id: string) => void;
  defaultOpen?: boolean;
}

function ComponentListSection({
  components = [],
  selectedId,
  onSelectItem,
  defaultOpen = true,
  className,
  ...props
}: ComponentListSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <section
      data-slot="component-list-section"
      className={cn(
        'bg-card border-border overflow-hidden rounded-lg border',
        className,
      )}
      {...props}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header */}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="border-border w-full justify-between rounded-none border-b px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Layers02Icon}
                className="text-muted-foreground size-4"
                strokeWidth={2}
              />
              <span className="text-sm font-medium">Components</span>
              {components.length > 0 && (
                <span className="text-muted-foreground text-xs">
                  ({components.length})
                </span>
              )}
            </div>
            <HugeiconsIcon
              icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon}
              className="text-muted-foreground size-4"
              strokeWidth={2}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="max-h-75">
            <div className="p-2">
              <ComponentTree
                components={components}
                selectedId={selectedId}
                onSelectItem={onSelectItem}
              />
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

export { ComponentListSection };
export type { ComponentListSectionProps };
