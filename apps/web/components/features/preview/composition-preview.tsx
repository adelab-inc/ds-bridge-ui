"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { LayoutIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

interface CompositionNode {
  componentId: string
  storyId?: string
  props?: Record<string, unknown>
  children?: CompositionNode[]
}

interface CompositionPreviewProps extends React.ComponentProps<"div"> {
  composition?: CompositionNode[]
}

function CompositionPreview({
  composition = [],
  className,
  ...props
}: CompositionPreviewProps) {
  if (composition.length === 0) {
    return (
      <div
        data-slot="composition-preview"
        className={cn(
          "bg-muted/50 text-muted-foreground flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center",
          className
        )}
        {...props}
      >
        <div className="bg-muted flex size-16 items-center justify-center rounded-full">
          <HugeiconsIcon icon={LayoutIcon} className="size-8" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Composition Preview</p>
          <p className="text-sm">
            채팅에서 컴포넌트를 조합하면
            <br />
            여기에서 미리 볼 수 있습니다
          </p>
        </div>
        <div className="bg-muted rounded-lg px-4 py-2 text-xs">
          🚧 이 기능은 준비 중입니다
        </div>
      </div>
    )
  }

  // TODO: Implement actual composition rendering
  return (
    <div
      data-slot="composition-preview"
      className={cn("flex-1 overflow-auto p-4", className)}
      {...props}
    >
      <div className="bg-background border-border rounded-lg border p-4">
        <pre className="text-muted-foreground text-xs">
          {JSON.stringify(composition, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export { CompositionPreview }
export type { CompositionPreviewProps, CompositionNode }
