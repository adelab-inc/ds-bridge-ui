'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlayIcon,
  LayoutIcon,
  SparklesIcon,
  Copy01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StorybookIframe } from './storybook-iframe';
import {
  CompositionPreview,
  type CompositionNode,
} from './composition-preview';
import { CodePreviewIframe, type PreviewViewMode } from './code-preview-iframe';
import { CodePreviewLoading } from './code-preview-loading';

interface PreviewSectionProps extends React.ComponentProps<'section'> {
  storybookUrl?: string;
  storyId?: string;
  composition?: CompositionNode[];
  /** AI 생성 코드 (있으면 AI Generated 탭 표시) */
  aiCode?: string;
  /** AI 생성 코드의 파일 경로 */
  aiFilePath?: string;
  /** AI 코드 생성 진행 중 여부 */
  isGeneratingCode?: boolean;
  defaultTab?: 'storybook' | 'composition' | 'ai-generated';
}

function PreviewSection({
  storybookUrl,
  storyId,
  composition = [],
  aiCode,
  aiFilePath,
  isGeneratingCode = false,
  defaultTab = 'storybook',
  className,
  ...props
}: PreviewSectionProps) {
  // AI 코드가 있거나 생성 중이면 자동으로 ai-generated 탭 선택
  const effectiveDefaultTab =
    aiCode || isGeneratingCode ? 'ai-generated' : defaultTab;

  // Controlled tabs state
  const [activeTab, setActiveTab] = React.useState<string>(effectiveDefaultTab);
  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<PreviewViewMode>('viewport');

  // aiCode 변경 시 탭 자동 전환
  React.useEffect(() => {
    if (aiCode || isGeneratingCode) {
      setActiveTab('ai-generated');
    }
  }, [aiCode, isGeneratingCode]);

  // 현재 URL 복사 핸들러
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return (
    <section
      data-slot="preview-section"
      className={cn('flex h-full flex-col overflow-hidden', className)}
      {...props}
    >
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex h-full flex-col overflow-hidden"
      >
        {/* Tabs Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-2">
          <TabsList>
            {(aiCode || isGeneratingCode) && (
              <TabsTrigger value="ai-generated" className="gap-1.5">
                <HugeiconsIcon
                  icon={SparklesIcon}
                  className="size-3.5"
                  strokeWidth={2}
                />
                AI Generated
              </TabsTrigger>
            )}
            <TabsTrigger value="storybook" className="gap-1.5">
              <HugeiconsIcon
                icon={PlayIcon}
                className="size-3.5"
                strokeWidth={2}
              />
              Storybook
            </TabsTrigger>
            <TabsTrigger value="composition" className="gap-1.5">
              <HugeiconsIcon
                icon={LayoutIcon}
                className="size-3.5"
                strokeWidth={2}
              />
              Composition
            </TabsTrigger>
          </TabsList>

          {/* 뷰 모드 선택기 - AI Generated 탭 활성화 시에만 표시 */}
          <div className="flex items-center gap-2">
            {activeTab === 'ai-generated' && (aiCode || isGeneratingCode) && (
              <div className="flex items-center rounded-md bg-muted p-0.5 text-xs">
                {(
                  [
                    { value: 'viewport', label: 'Viewport' },
                    { value: 'transform', label: 'Transform' },
                    { value: 'fit', label: 'Fit' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setViewMode(mode.value as PreviewViewMode)}
                    className={cn(
                      'rounded-sm px-2 py-0.5 font-medium transition-colors',
                      viewMode === mode.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            )}

            {/* 상태 표시 */}
            <div className="text-muted-foreground text-xs">
              {isGeneratingCode ? (
                <span className="flex items-center gap-1">
                  <span className="size-2 animate-pulse rounded-full bg-primary" />
                  생성 중...
                </span>
              ) : aiCode ? (
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-primary" />
                  AI 생성
                </span>
              ) : storybookUrl ? (
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-green-500" />
                  연결됨
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="bg-muted-foreground/50 size-2 rounded-full" />
                  연결 대기
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs Content with Copy Button */}
        <div className="relative flex-1 overflow-hidden">
          {/* Copy button - AI Generated 탭 활성화 시에만 표시 */}
          {aiCode && activeTab === 'ai-generated' && (
            <div className="absolute left-3 top-10 z-10">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-lg"
                      onClick={handleCopy}
                      className={cn(
                        'bg-background/80 backdrop-blur-sm hover:bg-background',
                        copied && 'border-green-600 text-green-600'
                      )}
                    >
                      <HugeiconsIcon
                        icon={copied ? Tick02Icon : Copy01Icon}
                        className="size-3.5"
                        strokeWidth={2}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{copied ? '복사됨!' : 'URL 복사'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* Tab Contents */}
          {(aiCode || isGeneratingCode) && (
            <TabsContent
              value="ai-generated"
              className="mt-0 h-full overflow-hidden data-[state=inactive]:hidden"
            >
              {isGeneratingCode && !aiCode ? (
                <CodePreviewLoading />
              ) : (
                <CodePreviewIframe
                  code={aiCode!}
                  filePath={aiFilePath}
                  viewMode={viewMode}
                />
              )}
            </TabsContent>
          )}

          <TabsContent
            value="storybook"
            className="mt-0 h-full overflow-hidden data-[state=inactive]:hidden"
          >
            <StorybookIframe url={storybookUrl} storyId={storyId} />
          </TabsContent>

          <TabsContent
            value="composition"
            className="mt-0 h-full overflow-hidden data-[state=inactive]:hidden"
          >
            <CompositionPreview composition={composition} />
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}

export { PreviewSection };
export type { PreviewSectionProps };
