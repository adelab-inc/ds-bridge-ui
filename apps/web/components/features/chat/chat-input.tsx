"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { SentIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"

interface ChatInputProps extends React.ComponentProps<"div"> {
  placeholder?: string
  onSend?: (message: string) => void
  disabled?: boolean
}

function ChatInput({
  placeholder = "메시지를 입력하세요...",
  onSend,
  disabled = false,
  className,
  ...props
}: ChatInputProps) {
  const [value, setValue] = React.useState("")

  const handleSubmit = () => {
    if (value.trim() && onSend) {
      onSend(value.trim())
      setValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      data-slot="chat-input"
      className={cn("border-border border-t p-4", className)}
      {...props}
    >
      <InputGroup className="h-auto">
        <InputGroupTextarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className="min-h-[2.5rem] max-h-32"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleSubmit}
            disabled={!value.trim() || disabled}
          >
            <HugeiconsIcon icon={SentIcon} strokeWidth={2} />
            <span className="sr-only">전송</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p className="text-muted-foreground mt-1.5 text-xs">
        Enter로 전송, Shift+Enter로 줄바꿈
      </p>
    </div>
  )
}

export { ChatInput }
export type { ChatInputProps }
