'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Copy01Icon,
  CodeIcon,
  Download02Icon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActionsSectionProps extends React.ComponentProps<'section'> {
  onCopyForAI?: () => void;
  onCopyTokens?: () => void;
  onExportJSON?: () => void;
  disabled?: boolean;
}

function ActionsSection({
  onCopyForAI,
  onCopyTokens,
  onExportJSON,
  disabled = false,
  className,
  ...props
}: ActionsSectionProps) {
  const handleCopyForAI = () => {
    if (onCopyForAI) {
      onCopyForAI();
    } else {
      console.log('Copy for AI clicked');
    }
  };

  const handleCopyTokens = () => {
    if (onCopyTokens) {
      onCopyTokens();
    } else {
      console.log('Copy Tokens clicked');
    }
  };

  const handleExportJSON = () => {
    if (onExportJSON) {
      onExportJSON();
    } else {
      console.log('Export JSON clicked');
    }
  };

  return (
    <TooltipProvider>
      <section
        data-slot="actions-section"
        className={cn(
          'bg-card border-border flex flex-col gap-2 rounded-lg border p-4',
          className
        )}
        {...props}
      >
        <h2 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
          Actions
        </h2>

        {/* Primary Action */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              className="w-full justify-start gap-2"
              onClick={handleCopyForAI}
              disabled={disabled}
            >
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
              Copy for AI
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>AI에게 전달할 프롬프트를 클립보드에 복사합니다</p>
          </TooltipContent>
        </Tooltip>

        <Separator className="my-1" />

        {/* Secondary Actions */}
        <div className="flex flex-col gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={handleCopyTokens}
                disabled={disabled}
              >
                <HugeiconsIcon
                  icon={CodeIcon}
                  className="size-3.5"
                  strokeWidth={2}
                />
                Copy Tokens
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>디자인 토큰을 복사합니다</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={handleExportJSON}
                disabled={disabled}
              >
                <HugeiconsIcon
                  icon={Download02Icon}
                  className="size-3.5"
                  strokeWidth={2}
                />
                Export JSON
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>ds.json 파일을 다운로드합니다</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Disabled State Message */}
        {disabled && (
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Storybook URL을 입력하면 활성화됩니다
          </p>
        )}
      </section>
    </TooltipProvider>
  );
}

export { ActionsSection };
export type { ActionsSectionProps };
