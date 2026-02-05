'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PageListItem } from '@/lib/types';

export default function PageList() {
  const [pages, setPages] = useState<PageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const response = await fetch('/api/pages');
      if (response.ok) {
        const data = await response.json();
        setPages(data);
      }
    } catch (error) {
      console.error('Failed to fetch pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPage = async () => {
    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
      });
      if (response.ok) {
        const { id } = await response.json();
        router.push(`/page/${id}`);
      }
    } catch (error) {
      console.error('Failed to create page:', error);
    }
  };

  const archivePage = async (id: string) => {
    if (!confirm('Are you sure you want to archive this page?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/pages/${id}/archive`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchPages();
      }
    } catch (error) {
      console.error('Failed to archive page:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return <div style={{ color: '#574a46' }}>Loading...</div>;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <h2 className="text-2xl font-bold" style={{ color: '#574a46' }}>
          Pages
        </h2>
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/archives')}
            className="px-6 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: '#f5eae6',
              color: '#574a46',
              border: '1px solid #574a46',
            }}
          >
            View Archives
          </button>
          <button
            onClick={createPage}
            className="px-6 py-2 rounded-lg transition-colors"
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
            New Page
          </button>
        </div>
      </div>

      {pages.length === 0 ? (
        <p style={{ color: '#574a46', opacity: 0.7 }}>
          No pages yet. Create your first page!
        </p>
      ) : (
        <div className="space-y-4">
          {pages.map((page) => (
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
                    className="text-xl font-semibold mb-2 cursor-pointer hover:underline"
                    style={{ color: '#574a46' }}
                    onClick={() => router.push(`/page/${page.id}`)}
                  >
                    {page.title}
                  </h3>
                  <p className="text-sm" style={{ color: '#574a46', opacity: 0.6 }}>
                    Updated: {formatDate(page.updated_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/page/${page.id}`)}
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
                    Open
                  </button>
                  <button
                    onClick={() => archivePage(page.id)}
                    className="px-4 py-2 rounded transition-colors text-sm"
                    style={{
                      backgroundColor: '#f5eae6',
                      color: '#574a46',
                      border: '1px solid #574a46',
                    }}
                  >
                    Archive
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
