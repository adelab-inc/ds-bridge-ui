'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Message01Icon } from '@hugeicons/core-free-icons';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookmarkDropdown } from './bookmark-dropdown';
import type { Bookmark } from '@/hooks/useBookmarks';

interface ChatHeaderProps {
  error: string | null;
  bookmarks: Bookmark[];
  selectedMessageId: string | null;
  onBookmarkSelect: (messageId: string) => void;
  onBookmarkDelete: (bookmarkId: string) => void;
}

function ChatHeader({
  error,
  bookmarks,
  selectedMessageId,
  onBookmarkSelect,
  onBookmarkDelete,
}: ChatHeaderProps) {
  return (
    <div className="border-border flex items-center gap-2 border-b px-4 py-3">
      <HugeiconsIcon
        icon={Message01Icon}
        className="text-muted-foreground size-4"
        strokeWidth={2}
      />
      <h2 className="text-sm font-medium">AI Navigator</h2>
      <div className="border-border h-4 border-l" />
      <TabsList variant="line">
        <TabsTrigger value="design">디자인 모드</TabsTrigger>
        <TabsTrigger value="description">디스크립션 모드</TabsTrigger>
      </TabsList>

      {error && <span className="text-destructive text-xs">{error}</span>}

      <BookmarkDropdown
        bookmarks={bookmarks}
        selectedMessageId={selectedMessageId}
        onSelect={onBookmarkSelect}
        onDelete={onBookmarkDelete}
      />
    </div>
  );
}

export { ChatHeader };
export type { ChatHeaderProps };
