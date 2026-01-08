"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

interface LeftPanelProps extends React.ComponentProps<"aside"> {
  children?: React.ReactNode
}

function LeftPanel({ className, children, ...props }: LeftPanelProps) {
  return (
    <aside
      data-slot="left-panel"
      className={cn(
        "bg-background border-border flex h-full flex-col border-r",
        className
      )}
      {...props}
    >
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">{children}</div>
      </ScrollArea>
    </aside>
  )
}

export { LeftPanel }
export type { LeftPanelProps }
