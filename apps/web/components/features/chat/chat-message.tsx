"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp?: Date
}

interface ChatMessageProps extends React.ComponentProps<"div"> {
  message: ChatMessage
}

function ChatMessage({ message, className, ...props }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      data-slot="chat-message"
      data-role={message.role}
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.timestamp && (
          <time
            className={cn(
              "mt-1 block text-xs opacity-60",
              isUser ? "text-right" : "text-left"
            )}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        )}
      </div>
    </div>
  )
}

export { ChatMessage }
export type { ChatMessageProps, ChatMessage as ChatMessageType }
