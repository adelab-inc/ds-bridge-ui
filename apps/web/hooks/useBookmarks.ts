'use client';

import { useState, useCallback } from 'react';

export interface Bookmark {
  id: string;
  messageId: string;
  roomId: string;
  label: string;
  question: string;
  createdAt: number;
}

const STORAGE_KEY = 'ds-bridge-bookmarks';

function getStoredBookmarks(): Bookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStoredBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function useBookmarks(roomId?: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(getStoredBookmarks);

  const addBookmark = useCallback(
    (params: {
      messageId: string;
      roomId: string;
      label: string;
      question: string;
    }) => {
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        ...params,
        createdAt: Date.now(),
      };
      setBookmarks((prev) => {
        const updated = [...prev, newBookmark];
        setStoredBookmarks(updated);
        return updated;
      });
    },
    []
  );

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      setStoredBookmarks(updated);
      return updated;
    });
  }, []);

  const isBookmarked = useCallback(
    (messageId: string) => {
      return bookmarks.some((b) => b.messageId === messageId);
    },
    [bookmarks]
  );

  const filteredBookmarks = roomId
    ? bookmarks.filter((b) => b.roomId === roomId)
    : bookmarks;

  return {
    bookmarks: filteredBookmarks,
    allBookmarks: bookmarks,
    addBookmark,
    removeBookmark,
    isBookmarked,
  };
}
