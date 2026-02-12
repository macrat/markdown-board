import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

export type PageError = 'not-found' | 'network-error';

export function usePageExists(pageId: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PageError | null>(null);
  const [archivedAt, setArchivedAt] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkExists = async () => {
      try {
        const response = await fetch(`/api/pages/${pageId}`);
        if (!isMounted) return;

        if (!response.ok) {
          const errorType =
            response.status === 404 ? 'not-found' : 'network-error';
          logger.error(
            `[Editor] Page check failed: ${pageId} (${response.status})`,
          );
          setError(errorType);
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (!isMounted) return;

        setArchivedAt(
          typeof data.archived_at === 'number' ? data.archived_at : null,
        );
        setLoading(false);
      } catch (error) {
        logger.error('[Editor] Failed to check page existence:', error);
        if (isMounted) {
          setError('network-error');
          setLoading(false);
        }
      }
    };

    checkExists();

    return () => {
      isMounted = false;
    };
  }, [pageId]);

  return { loading, error, archivedAt };
}
