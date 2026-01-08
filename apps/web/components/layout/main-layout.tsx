"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { LAYOUT } from "@/lib/constants"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { ClientOnly } from "@/components/ui/client-only"
import { Header } from "@/components/layout/header"
import { LeftPanel } from "@/components/layout/left-panel"
import { RightPanel } from "@/components/layout/right-panel"
import { MobileSheet } from "@/components/layout/mobile-sheet"

// Feature components (will be implemented in later phases)
import { ChatSection } from "@/components/features/chat/chat-section"
import { ComponentListSection } from "@/components/features/component-list/component-list-section"
import { ActionsSection } from "@/components/features/actions/actions-section"
import { PreviewSection } from "@/components/features/preview/preview-section"

interface MainLayoutProps extends React.ComponentProps<"div"> {
  children?: React.ReactNode
}

function MainLayout({ className, children, ...props }: MainLayoutProps) {
  const handleURLSubmit = (url: string) => {
    console.log("URL submitted:", url)
    // TODO: Implement URL parsing
  }

  const handleJSONUpload = (file: File) => {
    console.log("JSON uploaded:", file.name)
    // TODO: Implement JSON parsing
  }

  return (
    <div
      data-slot="main-layout"
      className={cn("bg-background flex h-screen flex-col overflow-hidden", className)}
      {...props}
    >
      {/* Header */}
      <Header onURLSubmit={handleURLSubmit} onJSONUpload={handleJSONUpload} />

      {/* Main Content */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Desktop Layout: Resizable Panels */}
        {/* ClientOnly로 감싸서 Base UI + react-resizable-panels의 SSR Hydration 이슈 방지 */}
        <div className="hidden h-full w-full md:block">
          <ClientOnly
            fallback={
              <div className="flex h-full w-full">
                <div className="bg-card h-full" style={{ width: `${LAYOUT.LEFT_PANEL_DEFAULT}%` }} />
                <div className="bg-border w-px" />
                <div className="bg-background h-full flex-1" />
              </div>
            }
          >
            <ResizablePanelGroup orientation="horizontal" id="main-layout">
              {/* Left Panel */}
              <ResizablePanel
                id="left-panel"
                defaultSize={LAYOUT.LEFT_PANEL_DEFAULT}
                minSize={`${LAYOUT.LEFT_PANEL_MIN_PX}px`}
                maxSize={`${LAYOUT.LEFT_PANEL_MAX_PX}px`}
              >
                <LeftPanel>
                  <ChatSection />
                  <ComponentListSection />
                  <ActionsSection />
                </LeftPanel>
              </ResizablePanel>

              {/* Resize Handle */}
              <ResizableHandle withHandle />

              {/* Right Panel */}
              <ResizablePanel id="right-panel" defaultSize={100 - LAYOUT.LEFT_PANEL_DEFAULT}>
                <RightPanel>
                  <PreviewSection />
                </RightPanel>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ClientOnly>
        </div>

        {/* Mobile Layout: Preview + Bottom Sheet */}
        <div className="flex h-full w-full flex-col md:hidden">
          {/* Preview takes full height minus bottom sheet */}
          <div
            className="flex-1 overflow-hidden"
            style={{ paddingBottom: `${LAYOUT.MOBILE_SHEET_DEFAULT_HEIGHT}vh` }}
          >
            <RightPanel className="h-full">
              <PreviewSection />
            </RightPanel>
          </div>

          {/* Mobile Bottom Sheet */}
          <MobileSheet
            chatContent={<ChatSection />}
            componentsContent={<ComponentListSection />}
            actionsContent={<ActionsSection />}
          />
        </div>
      </div>

      {children}
    </div>
  )
}

export { MainLayout }
export type { MainLayoutProps }
