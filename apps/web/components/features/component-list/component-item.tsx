"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface ComponentItemData {
  id: string
  name: string
  category?: string
  stories?: { id: string; name: string }[]
}

interface ComponentItemProps extends React.ComponentProps<"div"> {
  item: ComponentItemData
  isSelected?: boolean
  onClick?: () => void
}

function ComponentItem({
  item,
  isSelected = false,
  onClick,
  className,
  ...props
}: ComponentItemProps) {
  const storiesCount = item.stories?.length ?? 0

  return (
    <div
      data-slot="component-item"
      data-selected={isSelected}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
        "hover:bg-muted cursor-pointer",
        isSelected && "bg-muted",
        className
      )}
      onClick={onClick}
      {...props}
    >
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground shrink-0"
        tabIndex={-1}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" strokeWidth={2} />
      </Button>

      <span className="flex-1 truncate text-sm">{item.name}</span>

      {storiesCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {storiesCount}
        </Badge>
      )}
    </div>
  )
}

export { ComponentItem }
export type { ComponentItemProps, ComponentItemData }
