"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatMessage, type ChatMessageType } from "./chat-message"

interface ChatMessageListProps extends React.ComponentProps<"div"> {
  messages?: ChatMessageType[]
}

function ChatMessageList({
  messages = [],
  className,
  ...props
}: ChatMessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div
        data-slot="chat-message-list"
        className={cn(
          "text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm",
          className
        )}
        {...props}
      >
        <p>아직 메시지가 없습니다</p>
        <p className="text-xs">Storybook URL을 입력하고 채팅을 시작해보세요</p>
      </div>
    )
  }

  return (
    <ScrollArea
      ref={scrollRef}
      data-slot="chat-message-list"
      className={cn("flex-1", className)}
      {...props}
    >
      <div className="flex flex-col gap-3 p-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>
    </ScrollArea>
  )
}

export { ChatMessageList }
export type { ChatMessageListProps }
