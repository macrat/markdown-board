import { useState, useCallback } from 'react';
import type { PageListItem } from '@/lib/types';
import { logger } from '@/lib/logger';
import { logResponseError } from '@/lib/api';

export function usePageList() {
  const [pages, setPages] = useState<PageListItem[]>([]);

  const fetchPages = useCallback(async () => {
    try {
      const response = await fetch('/api/pages');
      if (!response.ok) {
        await logResponseError('PageBoard FetchPages', response);
        return;
      }
      const data = await response.json();
      setPages(data);
    } catch (error) {
      logger.error('[PageBoard FetchPages] Network error:', error);
    }
  }, []);

  const removePage = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { pages, fetchPages, removePage };
}
