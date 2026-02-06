import { useState, useCallback, useRef, useEffect } from 'react';
import type { PageListItem } from '@/lib/types';
import { logger } from '@/lib/logger';
import {
  logResponseError,
  isPageListItemArray,
  isCreatePageResponse,
} from '@/lib/api';

export function usePageList() {
  const [pages, setPages] = useState<PageListItem[]>([]);
  const pagesRef = useRef<PageListItem[]>([]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const fetchPages = useCallback(async () => {
    try {
      const response = await fetch('/api/pages');
      if (!response.ok) {
        await logResponseError('PageBoard FetchPages', response);
        return;
      }
      const data: unknown = await response.json();
      if (!isPageListItemArray(data)) {
        logger.error('[PageBoard FetchPages] Unexpected response shape:', data);
        return;
      }
      setPages(data);
    } catch (error) {
      logger.error('[PageBoard FetchPages] Network error:', error);
    }
  }, []);

  const createPage = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
      });
      if (!response.ok) {
        await logResponseError('PageBoard CreatePage', response);
        return null;
      }
      const data: unknown = await response.json();
      if (!isCreatePageResponse(data)) {
        logger.error('[PageBoard CreatePage] Unexpected response shape:', data);
        return null;
      }
      return data.id;
    } catch (error) {
      logger.error('[PageBoard CreatePage] Network error:', error);
      return null;
    }
  }, []);

  const removePage = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addPage = useCallback((page: PageListItem) => {
    setPages((prev) => [page, ...prev]);
  }, []);

  const findPage = useCallback((id: string) => {
    return pagesRef.current.find((p) => p.id === id);
  }, []);

  return { pages, fetchPages, createPage, removePage, addPage, findPage };
}
