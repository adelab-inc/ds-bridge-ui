"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayIcon, LayoutIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StorybookIframe } from "./storybook-iframe"
import { CompositionPreview, type CompositionNode } from "./composition-preview"

interface PreviewSectionProps extends React.ComponentProps<"section"> {
  storybookUrl?: string
  storyId?: string
  composition?: CompositionNode[]
  defaultTab?: "storybook" | "composition"
}

function PreviewSection({
  storybookUrl,
  storyId,
  composition = [],
  defaultTab = "storybook",
  className,
  ...props
}: PreviewSectionProps) {
  return (
    <section
      data-slot="preview-section"
      className={cn("flex h-full flex-col overflow-hidden", className)}
      {...props}
    >
      <Tabs
        defaultValue={defaultTab}
        className="flex h-full flex-col overflow-hidden"
      >
        {/* Tabs Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-2">
          <TabsList>
            <TabsTrigger value="storybook" className="gap-1.5">
              <HugeiconsIcon icon={PlayIcon} className="size-3.5" strokeWidth={2} />
              Storybook
            </TabsTrigger>
            <TabsTrigger value="composition" className="gap-1.5">
              <HugeiconsIcon icon={LayoutIcon} className="size-3.5" strokeWidth={2} />
              Composition
            </TabsTrigger>
          </TabsList>

          {/* Additional controls can be added here */}
          <div className="text-muted-foreground text-xs">
            {storybookUrl ? (
              <span className="flex items-center gap-1">
                <span className="bg-green-500 size-2 rounded-full" />
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
