import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import { logResponseError, isPage } from '@/lib/api';

export function useFetchPage(pageId: string) {
  const [pageContent, setPageContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const fetchPage = async () => {
      try {
        const response = await fetch(`/api/pages/${pageId}`);
        if (!response.ok) {
          await logResponseError('Editor FetchPage', response);
          if (isMounted) router.push('/');
          return;
        }

        const data: unknown = await response.json();
        if (!isMounted) return;

        if (!isPage(data)) {
          logger.error('[Editor FetchPage] Unexpected response shape:', data);
          if (isMounted) router.push('/');
          return;
        }

        setPageContent(data.content);
        setLoading(false);
      } catch (error) {
        logger.error('[Editor FetchPage] Network error:', error);
        if (isMounted) router.push('/');
      }
    };

    fetchPage();

    return () => {
      isMounted = false;
    };
  }, [pageId, router]);

  return { pageContent, loading };
}
