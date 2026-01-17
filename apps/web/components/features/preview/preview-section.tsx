"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayIcon, LayoutIcon, SparklesIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StorybookIframe } from "./storybook-iframe"
import { CompositionPreview, type CompositionNode } from "./composition-preview"
import { CodePreviewIframe } from "./code-preview-iframe"

interface PreviewSectionProps extends React.ComponentProps<"section"> {
  storybookUrl?: string
  storyId?: string
  composition?: CompositionNode[]
  /** AI 생성 코드 (있으면 AI Generated 탭 표시) */
  aiCode?: string
  /** AI 생성 코드의 파일 경로 */
  aiFilePath?: string
  defaultTab?: "storybook" | "composition" | "ai-generated"
}

function PreviewSection({
  storybookUrl,
  storyId,
  composition = [],
  aiCode,
  aiFilePath,
  defaultTab = "storybook",
  className,
  ...props
}: PreviewSectionProps) {
  // AI 코드가 있으면 자동으로 ai-generated 탭 선택
  const effectiveDefaultTab = aiCode ? "ai-generated" : defaultTab

  return (
    <section
      data-slot="preview-section"
      className={cn("flex h-full flex-col overflow-hidden", className)}
      {...props}
    >
      <Tabs
        defaultValue={effectiveDefaultTab}
        key={effectiveDefaultTab}
        className="flex h-full flex-col overflow-hidden"
      >
        {/* Tabs Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-2">
          <TabsList>
            {aiCode && (
              <TabsTrigger value="ai-generated" className="gap-1.5">
                <HugeiconsIcon icon={SparklesIcon} className="size-3.5" strokeWidth={2} />
                AI Generated
              </TabsTrigger>
            )}
            <TabsTrigger value="storybook" className="gap-1.5">
              <HugeiconsIcon icon={PlayIcon} className="size-3.5" strokeWidth={2} />
              Storybook
            </TabsTrigger>
            <TabsTrigger value="composition" className="gap-1.5">
              <HugeiconsIcon icon={LayoutIcon} className="size-3.5" strokeWidth={2} />
              Composition
            </TabsTrigger>
          </TabsList>

          {/* 상태 표시 */}
          <div className="text-muted-foreground text-xs">
            {aiCode ? (
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-purple-500" />
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

        {/* Tabs Content */}
        {aiCode && (
          <TabsContent
            value="ai-generated"
            className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
            <CodePreviewIframe code={aiCode} filePath={aiFilePath} />
          </TabsContent>
        )}

        <TabsContent
          value="storybook"
          className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          <StorybookIframe url={storybookUrl} storyId={storyId} />
        </TabsContent>

        <TabsContent
          value="composition"
          className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          <CompositionPreview composition={composition} />
        </TabsContent>
      </Tabs>
    </section>
  )
}

export { PreviewSection }
export type { PreviewSectionProps }
