"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Link02Icon,
  Upload01Icon,
  MoreVerticalIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { HeaderLogo } from "@/components/layout/header-logo"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface HeaderProps extends React.ComponentProps<"header"> {
  onURLSubmit?: (url: string) => void
  onJSONUpload?: (file: File) => void
  isLoading?: boolean
}

function Header({
  className,
  onURLSubmit,
  onJSONUpload,
  isLoading = false,
  ...props
}: HeaderProps) {
  const [url, setUrl] = React.useState("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim() && onURLSubmit) {
      onURLSubmit(url.trim())
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onJSONUpload) {
      onJSONUpload(file)
    }
    // Reset input
    e.target.value = ""
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <TooltipProvider>
      <header
        data-slot="header"
        className={cn(
          "bg-background/95 supports-[backdrop-filter]:bg-background/60 border-border sticky top-0 z-50 flex h-14 w-full items-center gap-3 border-b px-4 backdrop-blur md:px-6",
          className
        )}
        {...props}
      >
        {/* Logo (Server Component) */}
        <HeaderLogo />

        {/* URL Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
          <InputGroup className="max-w-xl flex-1">
            <InputGroupAddon align="inline-start">
              <InputGroupText>
                <HugeiconsIcon icon={Link02Icon} strokeWidth={2} />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              type="url"
              placeholder="Storybook URL 입력..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="submit"
                variant="ghost"
                size="xs"
                disabled={!url.trim() || isLoading}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                <span className="sr-only">URL 로드</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Upload JSON Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleUploadClick}
                disabled={isLoading}
              >
                <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
                <span className="sr-only">JSON 업로드</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>ds.json 파일 업로드</p>
            </TooltipContent>
          </Tooltip>

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
                <span className="sr-only">더보기</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>설정</DropdownMenuItem>
              <DropdownMenuItem>도움말</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>GitHub</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  )
}

export { Header }
export type { HeaderProps }
