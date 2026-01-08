"use client"

import * as React from "react"

import { LAYOUT } from "@/lib/constants"
import { RightPanel } from "@/components/layout/right-panel"
import { MobileSheet } from "@/components/layout/mobile-sheet"

// Feature components
import { ChatSection } from "@/components/features/chat/chat-section"
import { ComponentListSection } from "@/components/features/component-list/component-list-section"
import { ActionsSection } from "@/components/features/actions/actions-section"
import { PreviewSection } from "@/components/features/preview/preview-section"

interface MobileLayoutProps {
  onURLSubmit?: (url: string) => void
  onJSONUpload?: (file: File) => void
}

function MobileLayout({ onURLSubmit, onJSONUpload }: MobileLayoutProps) {
  return (
    <>
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
    </>
  )
}

export { MobileLayout }
export type { MobileLayoutProps }
