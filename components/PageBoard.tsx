'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { PageListItem, Page } from '@/lib/types';
import Toast from './Toast';
import { logger } from '@/lib/logger';

const ANIMATION_DURATION_MS = 200;

type Tab = 'latest' | 'archive';

interface AnimatingItem {
  id: string;
  type: 'fadeOut' | 'fadeIn';
}

interface ToastState {
  visible: boolean;
  pageId: string;
  pageTitle: string;
}

// SVG Icons
const ArchiveIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

const UnarchiveIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <polyline points="12 17 12 11" />
    <polyline points="9 14 12 11 15 14" />
  </svg>
);

const PlusIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default function PageBoard() {
  const [activeTab, setActiveTab] = useState<Tab>('latest');
  const [pages, setPages] = useState<PageListItem[]>([]);
  const [archives, setArchives] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [animatingItems, setAnimatingItems] = useState<AnimatingItem[]>([]);
  const [toast, setToast] = useState<ToastState>({ visible: false, pageId: '', pageTitle: '' });
  const router = useRouter();
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Cleanup timers on unmount to prevent memory leaks
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const fetchPages = useCallback(async () => {
    try {
      const response = await fetch('/api/pages');
      if (response.ok) {
        const data = await response.json();
        setPages(data);
      }
    } catch (error) {
      logger.error('Failed to fetch pages:', error);
    }
  }, []);

  const fetchArchives = useCallback(async () => {
    try {
      const response = await fetch('/api/archives');
      if (response.ok) {
        const data = await response.json();
        setArchives(data);
      }
    } catch (error) {
      logger.error('Failed to fetch archives:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPages(), fetchArchives()]);
      setLoading(false);
    };
    loadData();
  }, [fetchPages, fetchArchives]);

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
      logger.error('Failed to create page:', error);
    }
  };

  const archivePage = async (id: string, title: string) => {
    // Dismiss any existing toast immediately when archiving a new page
    setToast({ visible: false, pageId: '', pageTitle: '' });

    // Start fade out animation
    setAnimatingItems(prev => [...prev, { id, type: 'fadeOut' }]);

    const timer = setTimeout(async () => {
      timersRef.current.delete(timer);
      try {
        const response = await fetch(`/api/pages/${id}/archive`, {
          method: 'POST',
        });
        if (response.ok) {
          // Get the server-provided archived_at timestamp
          const data = await response.json();
          const archivedAt = data.archived_at ?? Date.now(); // Fallback to client time if not provided
          
          // Update local state
          const archivedPage = pages.find(p => p.id === id);
          if (archivedPage) {
            setPages(prev => prev.filter(p => p.id !== id));
            const newArchive: Page = {
              ...archivedPage,
              content: '',
              archived_at: archivedAt,
            };
            setArchives(prev => [newArchive, ...prev]);
          }

          // Show toast
          setToast({ visible: true, pageId: id, pageTitle: title });
        }
      } catch (error) {
        logger.error('Failed to archive page:', error);
      } finally {
        setAnimatingItems(prev => prev.filter(item => item.id !== id));
      }
    }, ANIMATION_DURATION_MS);
    timersRef.current.add(timer);
  };

  const cancelArchive = async () => {
    const { pageId } = toast;
    setToast({ visible: false, pageId: '', pageTitle: '' });

    try {
      const response = await fetch(`/api/pages/${pageId}/unarchive`, {
        method: 'POST',
      });
      if (response.ok) {
        // Refresh both lists
        await Promise.all([fetchPages(), fetchArchives()]);
      }
    } catch (error) {
      logger.error('Failed to cancel archive:', error);
    }
  };

  const unarchivePage = async (id: string) => {
    // Start fade out animation
    setAnimatingItems(prev => [...prev, { id, type: 'fadeOut' }]);

    const timer = setTimeout(async () => {
      timersRef.current.delete(timer);
      try {
        const response = await fetch(`/api/pages/${id}/unarchive`, {
          method: 'POST',
        });
        if (response.ok) {
          // Refresh both lists to get updated data
          await Promise.all([fetchPages(), fetchArchives()]);

          // Add fade in animation for the unarchived item
          setAnimatingItems(prev => [...prev.filter(item => item.id !== id), { id, type: 'fadeIn' }]);
          const fadeInTimer = setTimeout(() => {
            timersRef.current.delete(fadeInTimer);
            setAnimatingItems(prev => prev.filter(item => item.id !== id));
          }, ANIMATION_DURATION_MS);
          timersRef.current.add(fadeInTimer);
        }
      } catch (error) {
        logger.error('Failed to unarchive page:', error);
        // Only cleanup on error since success case handles its own cleanup
        setAnimatingItems(prev => prev.filter(item => item.id !== id));
      }
    }, ANIMATION_DURATION_MS);
    timersRef.current.add(timer);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getItemOpacity = (id: string) => {
    const animating = animatingItems.find(item => item.id === id);
    if (!animating) return 1;
    return animating.type === 'fadeOut' ? 0 : 1;
  };

  if (loading) {
    return (
      <div style={{ color: '#574a46', padding: '20px' }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Tab Navigation */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(87, 74, 70, 0.2)',
          marginBottom: '24px',
        }}
      >
        <button
          id="tab-latest"
          role="tab"
          aria-selected={activeTab === 'latest'}
          aria-controls="tabpanel-latest"
          onClick={() => setActiveTab('latest')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'latest' ? '2px solid #c42776' : '2px solid transparent',
            color: activeTab === 'latest' ? '#c42776' : '#574a46',
            fontWeight: activeTab === 'latest' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontSize: '16px',
          }}
        >
          最新
        </button>
        <button
          id="tab-archive"
          role="tab"
          aria-selected={activeTab === 'archive'}
          aria-controls="tabpanel-archive"
          onClick={() => setActiveTab('archive')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'archive' ? '2px solid #c42776' : '2px solid transparent',
            color: activeTab === 'archive' ? '#c42776' : '#574a46',
            fontWeight: activeTab === 'archive' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontSize: '16px',
          }}
        >
          アーカイブ
        </button>
      </div>

      {/* Latest Tab Content */}
      {activeTab === 'latest' && (
        <div role="tabpanel" id="tabpanel-latest" aria-labelledby="tab-latest">
          {pages.length === 0 ? (
            <p style={{ color: '#574a46', opacity: 0.7 }}>
              ページがありません。新しいページを作成しましょう。
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pages.map((page) => (
                <div
                  key={page.id}
                  data-testid={`page-item-${page.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    backgroundColor: 'rgba(245, 234, 230, 0.5)',
                    borderRadius: '8px',
                    border: '1px solid rgba(87, 74, 70, 0.1)',
                    opacity: getItemOpacity(page.id),
                    transition: 'opacity 0.2s ease-in-out',
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => router.push(`/page/${page.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/page/${page.id}`);
                      }
                    }}
                  >
                    <h3
                      style={{
                        color: '#574a46',
                        fontSize: '16px',
                        fontWeight: '500',
                        margin: 0,
                        marginBottom: '4px',
                      }}
                    >
                      {page.title}
                    </h3>
                    <p
                      style={{
                        color: '#574a46',
                        opacity: 0.6,
                        fontSize: '13px',
                        margin: 0,
                      }}
                    >
                      {formatDate(page.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      archivePage(page.id, page.title);
                    }}
                    aria-label="アーカイブする"
                    title="Archive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(87, 74, 70, 0.3)',
                      borderRadius: '8px',
                      color: '#574a46',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(87, 74, 70, 0.1)';
                      e.currentTarget.style.borderColor = '#574a46';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'rgba(87, 74, 70, 0.3)';
                    }}
                  >
                    <ArchiveIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Archive Tab Content */}
      {activeTab === 'archive' && (
        <div role="tabpanel" id="tabpanel-archive" aria-labelledby="tab-archive">
          {archives.length === 0 ? (
            <p style={{ color: '#574a46', opacity: 0.7 }}>
              アーカイブされたページはありません。
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {archives.map((page) => (
                <div
                  key={page.id}
                  data-testid={`archive-item-${page.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    backgroundColor: 'rgba(245, 234, 230, 0.5)',
                    borderRadius: '8px',
                    border: '1px solid rgba(87, 74, 70, 0.1)',
                    opacity: getItemOpacity(page.id),
                    transition: 'opacity 0.2s ease-in-out',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        color: '#574a46',
                        fontSize: '16px',
                        fontWeight: '500',
                        margin: 0,
                        marginBottom: '4px',
                      }}
                    >
                      {page.title}
                    </h3>
                    <p
                      style={{
                        color: '#574a46',
                        opacity: 0.6,
                        fontSize: '13px',
                        margin: 0,
                      }}
                    >
                      {page.archived_at ? formatDate(page.archived_at) : '-'}
                    </p>
                  </div>
                  <button
                    onClick={() => unarchivePage(page.id)}
                    aria-label="アーカイブを解除する"
                    title="Unarchive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(87, 74, 70, 0.3)',
                      borderRadius: '8px',
                      color: '#574a46',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(87, 74, 70, 0.1)';
                      e.currentTarget.style.borderColor = '#574a46';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'rgba(87, 74, 70, 0.3)';
                    }}
                  >
                    <UnarchiveIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={createPage}
        aria-label="新しいページを作成"
        title="Create new page"
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#c42776',
          color: '#f5eae6',
          border: 'none',
          boxShadow: '0 4px 12px rgba(196, 39, 118, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          zIndex: 100,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#e893c2';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#c42776';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <PlusIcon />
      </button>

      {/* Toast Notification */}
      {toast.visible && (
        <Toast
          message="アーカイブしました"
          onCancel={cancelArchive}
          onClose={() => setToast({ visible: false, pageId: '', pageTitle: '' })}
        />
      )}
    </div>
  );
}
