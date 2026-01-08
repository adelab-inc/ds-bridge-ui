import * as React from "react"

import { cn } from "@/lib/utils"

interface RightPanelProps extends React.ComponentProps<"main"> {
  children?: React.ReactNode
}

function RightPanel({ className, children, ...props }: RightPanelProps) {
  return (
    <main
      data-slot="right-panel"
      className={cn(
        "bg-muted/30 flex h-full flex-1 flex-col overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </main>
  )
}

export { RightPanel }
export type { RightPanelProps }
