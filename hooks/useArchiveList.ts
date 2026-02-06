import { useState, useCallback } from 'react';
import type { ArchiveListItem } from '@/lib/types';
import { logger } from '@/lib/logger';
import { logResponseError } from '@/lib/api';

export function useArchiveList() {
  const [archives, setArchives] = useState<ArchiveListItem[]>([]);

  const fetchArchives = useCallback(async () => {
    try {
      const response = await fetch('/api/archives');
      if (!response.ok) {
        await logResponseError('PageBoard FetchArchives', response);
        return;
      }
      const data = await response.json();
      setArchives(data);
    } catch (error) {
      logger.error('[PageBoard FetchArchives] Network error:', error);
    }
  }, []);

  const addArchive = useCallback((archive: ArchiveListItem) => {
    setArchives((prev) => [archive, ...prev]);
  }, []);

  return { archives, fetchArchives, addArchive };
}
