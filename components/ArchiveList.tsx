'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Page } from '@/lib/types';
import { logger } from '@/lib/logger';

export default function ArchiveList() {
  const [archives, setArchives] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    try {
      const response = await fetch('/api/archives');
      if (response.ok) {
        const data = await response.json();
        setArchives(data);
      }
    } catch (error) {
      logger.error('Failed to fetch archives:', error);
    } finally {
      setLoading(false);
    }
  };

  const unarchivePage = async (id: string) => {
    try {
      const response = await fetch(`/api/pages/${id}/unarchive`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchArchives();
      }
    } catch (error) {
      logger.error('Failed to unarchive page:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDaysRemaining = (archivedAt: number) => {
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const deleteAt = archivedAt + thirtyDaysInMs;
    const now = Date.now();
    const daysRemaining = Math.ceil((deleteAt - now) / (24 * 60 * 60 * 1000));
    return Math.max(0, daysRemaining);
  };

  if (loading) {
    return <div style={{ color: '#574a46' }}>Loading...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 rounded-lg transition-colors"
          style={{
            backgroundColor: '#f5eae6',
            color: '#574a46',
            border: '1px solid #574a46',
          }}
        >
          ← Back to Pages
        </button>
      </div>

      {archives.length === 0 ? (
        <p style={{ color: '#574a46', opacity: 0.7 }}>
          No archived pages.
        </p>
      ) : (
        <div className="space-y-4">
          {archives.map((page) => (
            <div
              key={page.id}
              className="p-6 rounded-lg shadow-sm border"
              style={{
                backgroundColor: 'rgba(245, 234, 230, 0.5)',
                borderColor: 'rgba(87, 74, 70, 0.2)',
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3
                    className="text-xl font-semibold mb-2"
                    style={{ color: '#574a46' }}
                  >
                    {page.title}
                  </h3>
                  <div className="text-sm space-y-1" style={{ color: '#574a46', opacity: 0.6 }}>
                    <p>Archived: {page.archived_at ? formatDate(page.archived_at) : 'Unknown'}</p>
                    <p>Days remaining: {page.archived_at ? getDaysRemaining(page.archived_at) : 0}</p>
                  </div>
                </div>
                <button
                  onClick={() => unarchivePage(page.id)}
                  className="px-4 py-2 rounded transition-colors text-sm"
                  style={{
                    backgroundColor: '#c42776',
                    color: '#f5eae6',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e893c2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#c42776';
                  }}
                >
                  Unarchive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
