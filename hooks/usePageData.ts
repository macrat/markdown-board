import { useState, useEffect, useRef } from 'react';
import type { Page } from '@/lib/types';
import { logger } from '@/lib/logger';
import { logResponseError } from '@/lib/api';

export function usePageData(pageId: string, onNotFound: () => void) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const onNotFoundRef = useRef(onNotFound);

  useEffect(() => {
    onNotFoundRef.current = onNotFound;
  }, [onNotFound]);

  useEffect(() => {
    let isMounted = true;

    const fetchPage = async () => {
      try {
        const response = await fetch(`/api/pages/${pageId}`);
        if (!response.ok) {
          await logResponseError('Editor FetchPage', response);
          if (isMounted) onNotFoundRef.current();
          return;
        }

        const data = await response.json();
        if (!isMounted) return;

        setPage(data);
        setLoading(false);
      } catch (error) {
        logger.error('[Editor FetchPage] Network error:', error);
        if (isMounted) onNotFoundRef.current();
      }
    };

    fetchPage();

    return () => {
      isMounted = false;
    };
  }, [pageId]);

  return { page, loading };
}
