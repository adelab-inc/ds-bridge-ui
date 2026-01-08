"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface StorybookIframeProps extends React.ComponentProps<"div"> {
  url?: string
  storyId?: string
}

function StorybookIframe({
  url,
  storyId,
  className,
  ...props
}: StorybookIframeProps) {
  const iframeSrc = React.useMemo(() => {
    if (!url) return null
    if (storyId) {
      return `${url}/iframe.html?id=${storyId}&viewMode=story`
    }
    return url
  }, [url, storyId])

  if (!iframeSrc) {
    return (
      <div
        data-slot="storybook-iframe"
        className={cn(
          "bg-muted/50 text-muted-foreground flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center",
          className
        )}
        {...props}
      >
        <div className="bg-muted flex size-16 items-center justify-center rounded-full">
          <svg
            className="size-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="font-medium">Storybook 프리뷰</p>
          <p className="text-sm">
            상단에서 Storybook URL을 입력하거나
            <br />
            ds.json 파일을 업로드해주세요
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      data-slot="storybook-iframe"
      className={cn("relative flex-1 overflow-hidden", className)}
      {...props}
    >
      <iframe
        src={iframeSrc}
        title="Storybook Preview"
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        loading="lazy"
      />
    </div>
  )
}

export { StorybookIframe }
export type { StorybookIframeProps }
