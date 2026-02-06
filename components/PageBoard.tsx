'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { PageListItem, ArchiveListItem } from '@/lib/types';
import Toast from './Toast';
import { usePageList } from '@/hooks/usePageList';
import { useArchives } from '@/hooks/useArchives';
import { useAnimatingItems } from '@/hooks/useAnimatingItems';
import { useArchiveToast } from '@/hooks/useArchiveToast';

type Tab = 'latest' | 'archive';

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
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const { pages, fetchPages, createPage, removePage, addPage, findPage } =
    usePageList();
  const {
    archives,
    fetchArchives,
    archivePage: archivePageApi,
    unarchivePage: unarchivePageApi,
    addArchive,
    removeArchive,
    findArchive,
  } = useArchives();
  const { startFadeOut, startFadeIn, clearAnimation, getItemOpacity } =
    useAnimatingItems();
  const { toast, showToast, hideToast } = useArchiveToast();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPages(), fetchArchives()]);
      setLoading(false);
    };
    loadData();
  }, [fetchPages, fetchArchives]);

  const handleCreatePage = async () => {
    const id = await createPage();
    if (id) {
      router.push(`/page/${id}`);
    }
  };

  const handleArchivePage = useCallback(
    (id: string, title: string) => {
      hideToast();

      startFadeOut(id, async () => {
        const archivedAt = await archivePageApi(id);
        if (archivedAt !== null) {
          const archivedPage = findPage(id);
          if (archivedPage) {
            removePage(id);
            const newArchive: ArchiveListItem = {
              ...archivedPage,
              archived_at: archivedAt,
            };
            addArchive(newArchive);
          }
          showToast(id, title);
        }
        clearAnimation(id);
      });
    },
    [
      hideToast,
      startFadeOut,
      archivePageApi,
      findPage,
      removePage,
      addArchive,
      showToast,
      clearAnimation,
    ],
  );

  const handleCancelArchive = useCallback(async () => {
    const { pageId } = toast;
    hideToast();

    const archivedPage = findArchive(pageId);
    if (archivedPage) {
      const restoredPage: PageListItem = {
        id: archivedPage.id,
        title: archivedPage.title,
        created_at: archivedPage.created_at,
        updated_at: archivedPage.updated_at,
      };
      addPage(restoredPage);
      removeArchive(pageId);
      startFadeIn(pageId);
    }

    const success = await unarchivePageApi(pageId);
    if (!success) {
      await Promise.all([fetchPages(), fetchArchives()]);
    }
  }, [
    toast,
    hideToast,
    findArchive,
    addPage,
    removeArchive,
    startFadeIn,
    unarchivePageApi,
    fetchPages,
    fetchArchives,
  ]);

  const handleUnarchivePage = useCallback(
    (id: string) => {
      startFadeOut(id, async () => {
        const success = await unarchivePageApi(id);
        if (!success) {
          clearAnimation(id);
          return;
        }
        await Promise.all([fetchPages(), fetchArchives()]);
        startFadeIn(id);
      });
    },
    [
      startFadeOut,
      unarchivePageApi,
      clearAnimation,
      fetchPages,
      fetchArchives,
      startFadeIn,
    ],
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div style={{ color: '#574a46', padding: '20px' }}>読み込み中...</div>
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
          className="tab-button"
          aria-selected={activeTab === 'latest'}
          aria-controls="tabpanel-latest"
          onClick={() => setActiveTab('latest')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom:
              activeTab === 'latest'
                ? '2px solid #c42776'
                : '2px solid transparent',
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
          className="tab-button"
          aria-selected={activeTab === 'archive'}
          aria-controls="tabpanel-archive"
          onClick={() => setActiveTab('archive')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom:
              activeTab === 'archive'
                ? '2px solid #c42776'
                : '2px solid transparent',
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
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
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
                    aria-label={`${page.title}を開く`}
                    className="page-list-item-button"
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
                      handleArchivePage(page.id, page.title);
                    }}
                    className="archive-button"
                    aria-label="アーカイブする"
                    title="アーカイブ"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '44px',
                      height: '44px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(87, 74, 70, 0.3)',
                      borderRadius: '8px',
                      color: '#574a46',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'rgba(87, 74, 70, 0.1)';
                      e.currentTarget.style.borderColor = '#574a46';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor =
                        'rgba(87, 74, 70, 0.3)';
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'rgba(87, 74, 70, 0.1)';
                      e.currentTarget.style.borderColor = '#574a46';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor =
                        'rgba(87, 74, 70, 0.3)';
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
        <div
          role="tabpanel"
          id="tabpanel-archive"
          aria-labelledby="tab-archive"
        >
          <p
            style={{
              color: '#574a46',
              opacity: 0.4,
              fontSize: '12px',
              margin: '0 0 16px 0',
            }}
          >
            30日間保持されます
          </p>
          {archives.length === 0 ? (
            <p style={{ color: '#574a46', opacity: 0.7 }}>
              アーカイブされたページはありません。
            </p>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
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
                      {formatDate(page.archived_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnarchivePage(page.id)}
                    className="unarchive-button"
                    aria-label="アーカイブを解除する"
                    title="アーカイブを解除"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '44px',
                      height: '44px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(87, 74, 70, 0.3)',
                      borderRadius: '8px',
                      color: '#574a46',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'rgba(87, 74, 70, 0.1)';
                      e.currentTarget.style.borderColor = '#574a46';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor =
                        'rgba(87, 74, 70, 0.3)';
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'rgba(87, 74, 70, 0.1)';
                      e.currentTarget.style.borderColor = '#574a46';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor =
                        'rgba(87, 74, 70, 0.3)';
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
        onClick={handleCreatePage}
        className="fab-button"
        aria-label="新しいページを作成"
        title="新しいページを作成"
        style={{
          position: 'fixed',
          bottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
          right: 'max(16px, calc(env(safe-area-inset-right, 0px) + 16px))',
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
        onFocus={(e) => {
          e.currentTarget.style.backgroundColor = '#e893c2';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onBlur={(e) => {
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
          onCancel={handleCancelArchive}
          onClose={hideToast}
        />
      )}
    </div>
  );
}
