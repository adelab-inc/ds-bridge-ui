"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

interface CollapsibleTriggerProps extends Omit<CollapsiblePrimitive.Trigger.Props, 'render'> {
  asChild?: boolean
  children?: React.ReactNode
}

function CollapsibleTrigger({ asChild, children, ...props }: CollapsibleTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return (
      <CollapsiblePrimitive.Trigger
        data-slot="collapsible-trigger"
        render={children}
        {...props}
      />
    )
  }

  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props}>
      {children}
    </CollapsiblePrimitive.Trigger>
  )
}

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
