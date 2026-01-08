"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { ComponentItem, type ComponentItemData } from "./component-item"

interface ComponentTreeProps extends Omit<React.ComponentProps<"div">, 'onSelect'> {
  components?: ComponentItemData[]
  selectedId?: string
  onSelectItem?: (id: string) => void
}

function ComponentTree({
  components = [],
  selectedId,
  onSelectItem,
  className,
  ...props
}: ComponentTreeProps) {
  // Group components by category
  const groupedComponents = React.useMemo(() => {
    const groups: Record<string, ComponentItemData[]> = {}

    components.forEach((component) => {
      const category = component.category || "Uncategorized"
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(component)
    })

    return groups
  }, [components])

  const categories = Object.keys(groupedComponents).sort()

  if (components.length === 0) {
    return (
      <div
        data-slot="component-tree"
        className={cn(
          "text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center text-sm",
          className
        )}
        {...props}
      >
        <p>컴포넌트가 없습니다</p>
        <p className="text-xs">Storybook URL을 입력해주세요</p>
      </div>
    )
  }

  return (
    <div
      data-slot="component-tree"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    >
      {categories.map((category) => (
        <CategoryGroup
          key={category}
          name={category}
          components={groupedComponents[category]}
          selectedId={selectedId}
          onSelectItem={onSelectItem}
        />
      ))}
    </div>
  )
}

interface CategoryGroupProps {
  name: string
  components: ComponentItemData[]
  selectedId?: string
  onSelectItem?: (id: string) => void
}

function CategoryGroup({
  name,
  components,
  selectedId,
  onSelectItem,
}: CategoryGroupProps) {
  const [isOpen, setIsOpen] = React.useState(true)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground w-full justify-start gap-2 px-2"
        >
          <HugeiconsIcon
            icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon}
            className="size-3"
            strokeWidth={2}
          />
          <span className="flex-1 text-left text-xs font-medium uppercase">
            {name}
          </span>
          <span className="text-muted-foreground text-xs">
            {components.length}
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-2">
        {components.map((component) => (
          <ComponentItem
            key={component.id}
            item={component}
            isSelected={selectedId === component.id}
            onClick={() => onSelectItem?.(component.id)}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export { ComponentTree }
export type { ComponentTreeProps }
