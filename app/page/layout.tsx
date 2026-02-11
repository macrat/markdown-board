'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';

export default function PageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const handleScroll = () => {
      setScrolled(mainEl.scrollTop > 0);
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="h-dvh flex overflow-hidden">
      {/* Sidebar: hidden on mobile, shown as overlay when sidebarOpen; always visible on desktop */}
      <aside
        className={[
          sidebarOpen
            ? 'fixed inset-y-0 left-0 z-50 flex flex-col w-80 max-w-[85vw] bg-[var(--background)] shadow-xl'
            : 'hidden',
          'md:relative md:inset-auto md:z-auto md:flex md:flex-col md:w-80 md:max-w-none md:bg-transparent md:shadow-none md:border-r md:border-[rgba(var(--foreground-rgb),0.1)]',
        ].join(' ')}
        role={sidebarOpen ? 'dialog' : undefined}
        aria-modal={sidebarOpen || undefined}
      >
        <Sidebar onNavigate={closeSidebar} />
      </aside>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Main content area */}
      <div ref={mainRef} className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Hamburger menu button (mobile only) */}
        <button
          className={`hamburger-menu-button flex items-center justify-center md:hidden${scrolled ? ' scrolled' : ''}`}
          onClick={openSidebar}
          aria-label="ページ一覧を開く"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {children}
      </div>
    </div>
  );
}
