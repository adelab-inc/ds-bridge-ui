'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Bookmark02Icon,
  Delete02Icon,
  Tick01Icon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Bookmark } from '@/hooks/useBookmarks';

interface BookmarkDropdownProps {
  bookmarks: Bookmark[];
  selectedMessageId: string | null;
  onSelect: (messageId: string) => void;
  onDelete: (bookmarkId: string) => void;
}

function BookmarkDropdown({
  bookmarks,
  selectedMessageId,
  onSelect,
  onDelete,
}: BookmarkDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto rounded-full"
          aria-label="북마크 목록"
        >
          <HugeiconsIcon
            icon={Bookmark02Icon}
            className="size-4"
            strokeWidth={2}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={4}
        className="w-64"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>북마크</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {bookmarks.length === 0 ? (
          <p className="text-muted-foreground px-2 py-3 text-center text-xs">
            북마크가 없습니다
          </p>
        ) : (
          bookmarks.map((bm) => (
            <DropdownMenuItem
              key={bm.id}
              className="flex items-center justify-between gap-2"
              onClick={() => onSelect(bm.messageId)}
            >
              {selectedMessageId === bm.messageId && (
                <HugeiconsIcon
                  icon={Tick01Icon}
                  className="text-primary size-3.5 shrink-0"
                  strokeWidth={2}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{bm.label}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {new Date(bm.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive shrink-0 p-0.5 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(bm.id);
                }}
                aria-label="북마크 삭제"
              >
                <HugeiconsIcon
                  icon={Delete02Icon}
                  className="size-3.5"
                  strokeWidth={2}
                />
              </button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { BookmarkDropdown };
export type { BookmarkDropdownProps };
