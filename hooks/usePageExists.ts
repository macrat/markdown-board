import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

export function usePageExists(pageId: string) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
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

  return { loading };
}
