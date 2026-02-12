import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

const checkedPages = new Map<string, number | null>();

export function clearPageExistsCache() {
  checkedPages.clear();
}

export function usePageExists(pageId: string) {
  const cached = checkedPages.has(pageId);
  const [loading, setLoading] = useState(!cached);
  const [archivedAt, setArchivedAt] = useState<number | null>(
    cached ? (checkedPages.get(pageId) ?? null) : null,
  );
  const router = useRouter();

  useEffect(() => {
    if (checkedPages.has(pageId)) return;

    let isMounted = true;

    const checkExists = async () => {
      try {
        const response = await fetch(`/api/pages/${pageId}`);
        if (!isMounted) return;

        if (!response.ok) {
          logger.error(
            `[Editor] Page not found: ${pageId} (${response.status})`,
          );
          router.push('/');
          return;
        }

        const data = await response.json();
        if (!isMounted) return;

        const archived =
          typeof data.archived_at === 'number' ? data.archived_at : null;
        checkedPages.set(pageId, archived);
        setArchivedAt(archived);
        setLoading(false);
      } catch (error) {
        logger.error('[Editor] Failed to check page existence:', error);
        if (isMounted) {
          router.push('/');
        }
      }
    };

    checkExists();

    return () => {
      isMounted = false;
    };
  }, [pageId, router]);

  return { loading, archivedAt };
}
