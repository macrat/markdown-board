'use client';

import { ReactNode, useState, useEffect } from 'react';
import { formatRelativeTime } from '@/lib/utils';

interface PageListItemProps {
  dataTestId: string;
  title: string;
  timestamp: number;
  opacity: number;
  onNavigate?: () => void;
  navigateAriaLabel?: string;
  onAction: () => void;
  actionAriaLabel: string;
  actionTitle: string;
  actionClassName: string;
  actionIcon: ReactNode;
}

export default function PageListItem({
  dataTestId,
  title,
  timestamp,
  opacity,
  onNavigate,
  navigateAriaLabel,
  onAction,
  actionAriaLabel,
  actionTitle,
  actionClassName,
  actionIcon,
}: PageListItemProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const formattedDate = formatRelativeTime(timestamp, now);

  const titleDateContent = (
    <>
      <h3
        style={{
          color: '#574a46',
          fontSize: '16px',
          fontWeight: '500',
          margin: 0,
          marginBottom: '4px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: '#574a46',
          opacity: 0.6,
          fontSize: '13px',
          margin: 0,
        }}
      >
        {formattedDate}
      </p>
    </>
  );

  return (
    <div
      data-testid={dataTestId}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        backgroundColor: 'rgba(245, 234, 230, 0.5)',
        borderRadius: '8px',
        border: '1px solid rgba(87, 74, 70, 0.1)',
        opacity,
        transition: 'opacity 0.2s ease-in-out',
      }}
    >
      {onNavigate ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={navigateAriaLabel}
          className="page-list-item-button"
          style={{ flex: 1, cursor: 'pointer' }}
          onClick={onNavigate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate();
            }
          }}
        >
          {titleDateContent}
        </div>
      ) : (
        <div style={{ flex: 1 }}>{titleDateContent}</div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
        className={actionClassName}
        aria-label={actionAriaLabel}
        title={actionTitle}
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
      >
        {actionIcon}
      </button>
    </div>
  );
}
