'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ANIMATION_DURATION_MS } from '@/lib/constants';

interface ToastProps {
  message: string;
  onCancel: () => void;
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  onCancel,
  onClose,
  duration = 5000,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const isMountedRef = useRef(true);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (animationTimeoutRef.current !== null) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      if (autoCloseTimerRef.current !== null) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

  const scheduleAnimationTimeout = useCallback((callback: () => void) => {
    // Clear auto-close timer to prevent race condition
    if (autoCloseTimerRef.current !== null) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    setIsExiting(true);
    if (animationTimeoutRef.current !== null) {
      clearTimeout(animationTimeoutRef.current);
    }
    animationTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
      animationTimeoutRef.current = null;
    }, ANIMATION_DURATION_MS);
  }, []);

  const handleClose = useCallback(() => {
    scheduleAnimationTimeout(onClose);
  }, [onClose, scheduleAnimationTimeout]);

  const handleCancel = useCallback(() => {
    scheduleAnimationTimeout(onCancel);
  }, [onCancel, scheduleAnimationTimeout]);

  useEffect(() => {
    // Trigger fade in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    autoCloseTimerRef.current = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      if (autoCloseTimerRef.current !== null) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [duration, handleClose]);

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--foreground)',
        color: 'var(--background)',
        padding: '12px 20px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 4px 12px rgba(var(--foreground-rgb), 0.3)',
        opacity: isVisible && !isExiting ? 1 : 0,
        transition: `opacity ${ANIMATION_DURATION_MS}ms ease-in-out`,
        zIndex: 1000,
      }}
    >
      <span>{message}</span>
      <button
        onClick={handleCancel}
        className="toast-cancel-button"
        style={{
          backgroundColor: 'transparent',
          color: 'var(--accent-light)',
          border: '1px solid var(--accent-light)',
          padding: '4px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            'rgba(var(--accent-light-rgb), 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        onFocus={(e) => {
          e.currentTarget.style.backgroundColor =
            'rgba(var(--accent-light-rgb), 0.2)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        キャンセル
      </button>
    </div>
  );
}
