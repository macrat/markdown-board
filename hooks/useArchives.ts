import { useState, useCallback, useRef, useEffect } from 'react';
import type { ArchiveListItem } from '@/lib/types';
import { logger } from '@/lib/logger';
import {
  logResponseError,
  isArchiveListItemArray,
  isArchivePageResponse,
} from '@/lib/api';

export function useArchives() {
  const [archives, setArchives] = useState<ArchiveListItem[]>([]);
  const archivesRef = useRef<ArchiveListItem[]>([]);

  useEffect(() => {
    archivesRef.current = archives;
  }, [archives]);

  const fetchArchives = useCallback(async () => {
    try {
      const response = await fetch('/api/archives');
      if (!response.ok) {
        await logResponseError('PageBoard FetchArchives', response);
        return;
      }
      const data: unknown = await response.json();
      if (!isArchiveListItemArray(data)) {
        logger.error(
          '[PageBoard FetchArchives] Unexpected response shape:',
          data,
        );
        return;
      }
      setArchives(data);
    } catch (error) {
      logger.error('[PageBoard FetchArchives] Network error:', error);
    }
  }, []);

  const archivePage = useCallback(
    async (id: string): Promise<number | null> => {
      try {
        const response = await fetch(`/api/pages/${id}/archive`, {
          method: 'POST',
        });
        if (!response.ok) {
          await logResponseError('PageBoard ArchivePage', response);
          return null;
        }
        const data: unknown = await response.json();
        if (!isArchivePageResponse(data)) {
          logger.error(
            '[PageBoard ArchivePage] Unexpected response shape:',
            data,
          );
          return null;
        }
        return data.archived_at;
      } catch (error) {
        logger.error('[PageBoard ArchivePage] Network error:', error);
        return null;
      }
    },
    [],
  );

  const unarchivePage = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/pages/${id}/unarchive`, {
        method: 'POST',
      });
      if (!response.ok) {
        await logResponseError('PageBoard UnarchivePage', response);
        return false;
      }
      return true;
    } catch (error) {
      logger.error('[PageBoard UnarchivePage] Network error:', error);
      return false;
    }
  }, []);

  const addArchive = useCallback((archive: ArchiveListItem) => {
    setArchives((prev) => [archive, ...prev]);
  }, []);

  const removeArchive = useCallback((id: string) => {
    setArchives((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const findArchive = useCallback((id: string) => {
    return archivesRef.current.find((p) => p.id === id);
  }, []);

  return {
    archives,
    fetchArchives,
    archivePage,
    unarchivePage,
    addArchive,
    removeArchive,
    findArchive,
  };
}
