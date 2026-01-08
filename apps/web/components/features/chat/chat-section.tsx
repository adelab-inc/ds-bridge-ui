"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Message01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { ChatMessageList } from "./chat-message-list"
import { ChatInput } from "./chat-input"
import type { ChatMessageType } from "./chat-message"

interface ChatSectionProps extends React.ComponentProps<"section"> {
  messages?: ChatMessageType[]
  onSendMessage?: (message: string) => void
  isLoading?: boolean
}

function ChatSection({
  messages = [],
  onSendMessage,
  isLoading = false,
  className,
  ...props
}: ChatSectionProps) {
  const handleSend = (message: string) => {
    if (onSendMessage) {
      onSendMessage(message)
    } else {
      // Demo mode - just log
      console.log("Message sent:", message)
    }
  }

  return (
    <section
      data-slot="chat-section"
      className={cn(
        "bg-card border-border flex flex-col overflow-hidden rounded-lg border",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <HugeiconsIcon
          icon={Message01Icon}
          className="text-muted-foreground size-4"
          strokeWidth={2}
        />
        <h2 className="text-sm font-medium">AI Navigator</h2>
      </div>

      {/* Messages */}
      <ChatMessageList messages={messages} className="min-h-[200px] flex-1" />

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </section>
  )
}

export { ChatSection }
export type { ChatSectionProps }
